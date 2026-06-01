import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DB_PATH = process.env.ASG100_DB_PATH || path.join(DATA_DIR, "asg100.db");

let _db = null;

export function getDb() {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");

  // ── 1. users ──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      phone         TEXT NOT NULL UNIQUE,
      created_at    INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  `);

  // ── 2. reports ──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      user_phone      TEXT    NOT NULL,
      created_at      INTEGER NOT NULL,
      scenario        TEXT    NOT NULL,
      scenario_label  TEXT,
      hazard_count    INTEGER NOT NULL DEFAULT 0,
      report_json     TEXT    NOT NULL,
      duration_ms     INTEGER,
      ip              TEXT,
      user_agent      TEXT,
      image_base64    TEXT,
      image_mime      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_user      ON reports(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_phone     ON reports(user_phone, created_at DESC);
  `);

  // additive migration for older reports tables
  const reportCols = new Set(_db.prepare("PRAGMA table_info(reports)").all().map((c) => c.name));
  if (!reportCols.has("image_base64")) _db.exec("ALTER TABLE reports ADD COLUMN image_base64 TEXT");
  if (!reportCols.has("image_mime"))   _db.exec("ALTER TABLE reports ADD COLUMN image_mime TEXT");

  // ── 3. sms_codes（验证码，bcrypt hash，5min 过期）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS sms_codes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      phone      TEXT    NOT NULL,
      code_hash  TEXT    NOT NULL,
      expires_at INTEGER NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      attempts   INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone, expires_at DESC);
  `);

  // ── 4. orders（支付订单，幂等 out_trade_no）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      out_trade_no  TEXT    NOT NULL UNIQUE,
      package_id    TEXT    NOT NULL,
      amount_cents  INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      payer_openid  TEXT,
      payer_phone   TEXT,
      created_at    INTEGER NOT NULL,
      paid_at       INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_trade_no ON orders(out_trade_no);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(payer_phone, created_at DESC);
  `);

  // ── 5. memberships（VIP 到期时间，phone 为 PK）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS memberships (
      phone            TEXT    PRIMARY KEY,
      vip_expire_at    INTEGER NOT NULL DEFAULT 0,
      total_paid_cents INTEGER NOT NULL DEFAULT 0,
      updated_at       INTEGER NOT NULL
    );
  `);

  // ── 6. membership_ledger（会员变更流水，幂等）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS membership_ledger (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      phone            TEXT    NOT NULL,
      type             TEXT    NOT NULL,
      duration_days    INTEGER NOT NULL,
      expire_before    INTEGER NOT NULL,
      expire_after     INTEGER NOT NULL,
      amount_cents     INTEGER NOT NULL DEFAULT 0,
      related_order_id TEXT,
      created_at       INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_order
      ON membership_ledger(related_order_id) WHERE related_order_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ledger_phone ON membership_ledger(phone, created_at DESC);
  `);

  // ── 7. documents（安防文档库）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT    NOT NULL,
      category        TEXT,
      description     TEXT,
      preview_json    TEXT,
      attachment_json TEXT,
      required_tier   TEXT    NOT NULL DEFAULT 'free',
      status          TEXT    NOT NULL DEFAULT 'published',
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category, sort_order);
    CREATE INDEX IF NOT EXISTS idx_documents_tier     ON documents(required_tier, status);
  `);

  // ── 8. document_downloads（查看/下载记录）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS document_downloads (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      document_id    INTEGER NOT NULL,
      document_title TEXT,
      action         TEXT    NOT NULL DEFAULT 'download',
      created_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_doc_dl_user ON document_downloads(user_id, created_at DESC);
  `);

  // ── 9. rate-limiter-flexible 预建表（避免首次请求 race）──
  for (const name of [
    "rl_sms_code_phone",
    "rl_sms_code_ip",
    "rl_login_phone",
    "rl_charge_user",
    "rl_charge_ip",
  ]) {
    _db.exec(`
      CREATE TABLE IF NOT EXISTS ${name} (
        key    TEXT PRIMARY KEY,
        points INTEGER NOT NULL DEFAULT 0,
        expire INTEGER
      );
    `);
  }

  return _db;
}

export function upsertUserByPhone(phone) {
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone);
  if (existing) {
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, existing.id);
    return existing.id;
  }
  const info = db
    .prepare("INSERT INTO users(phone, created_at, last_login_at) VALUES (?, ?, ?)")
    .run(phone, now, now);
  return Number(info.lastInsertRowid);
}

export function insertReport(payload) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO reports(
        user_id, user_phone, created_at,
        scenario, scenario_label, hazard_count,
        report_json, duration_ms, ip, user_agent,
        image_base64, image_mime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.userId,
      payload.userPhone,
      payload.createdAt,
      payload.scenario,
      payload.scenarioLabel || null,
      payload.hazardCount,
      JSON.stringify(payload.report),
      payload.durationMs ?? null,
      payload.ip ?? null,
      payload.userAgent ?? null,
      payload.imageBase64 ?? null,
      payload.imageMime ?? null,
    );
  return Number(info.lastInsertRowid);
}
