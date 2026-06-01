// 个人历史聚合：中心【只读】挂载各业务积木的库，按当前登录 phone 聚合"我的记录"。
// 即"C 端的 admin-hub"——和 admin-hub 同模式（参照 B100/lib/db.ts getAdminDb），
// 唯一区别：admin-hub 看全量，这里 WHERE user_phone = 我自己。
//
// 铁律（admin-hub 血泪）：只 SELECT，绝不写别人的库。WAL 下只读不阻塞 A600 写、不触发 BUSY。
//
// 设计：用【独立只读连接】（不复用会员主连接 getDb），避免 ATTACH 污染会员库的主连接。
// 业务库可能不存在（A600 还没跑过识别）→ readonly 打开会抛，捕获后返空。

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// A600 识别库路径。部署时用 ASG_HAZARD_DB_PATH 指向 A600 的 data/hazard-detect.db 绝对路径。
const HAZARD_DB_PATH =
  process.env.ASG_HAZARD_DB_PATH ||
  path.join(PROJECT_ROOT, "..", "A600-隐患识别-hazard-detect", "data", "hazard-detect.db");

// A800 文档库路径。部署时用 ASG_DOC_DB_PATH 指向 A800 的 data/doc-library.db 绝对路径。
const DOC_DB_PATH =
  process.env.ASG_DOC_DB_PATH ||
  path.join(PROJECT_ROOT, "..", "A800-安防文档库-doc-library", "data", "doc-library.db");

/**
 * 查"我的"隐患识别历史（只读 A600 reports）。
 * 库不存在或查询失败 → 返空数组（个人历史是展示，失败降级为"暂无"，不报错）。
 * @param {string} phone 当前登录手机号
 * @param {number} limit
 * @returns {Array<{id,scenario,scenarioLabel,hazardCount,createdAt,source}>}
 */
export function getHazardHistory(phone, limit = 50) {
  if (!phone) return [];
  if (!fs.existsSync(HAZARD_DB_PATH)) return [];
  let db;
  try {
    db = new Database(HAZARD_DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 5000");
    const rows = db
      .prepare(
        `SELECT id, scenario, scenario_label, hazard_count, created_at
         FROM reports WHERE user_phone = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(phone, limit);
    return rows.map((r) => ({
      id: r.id,
      source: "hazard",
      scenario: r.scenario,
      scenarioLabel: r.scenario_label || r.scenario,
      hazardCount: r.hazard_count,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("[history] 读 A600 reports 失败:", err?.message || err);
    return [];
  } finally {
    if (db) db.close();
  }
}

/**
 * 查"我的"文档下载记录（只读 Z200 document_downloads）。
 * 库不存在或失败 → 返空（降级）。
 */
export function getDocDownloadHistory(phone, limit = 50) {
  if (!phone) return [];
  if (!fs.existsSync(DOC_DB_PATH)) return [];
  let db;
  try {
    db = new Database(DOC_DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 5000");
    const rows = db
      .prepare(
        `SELECT id, document_id, document_title, action, created_at
         FROM document_downloads WHERE user_phone = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(phone, limit);
    return rows.map((r) => ({
      id: r.id,
      source: "doc",
      documentId: r.document_id,
      title: r.document_title,
      action: r.action,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("[history] 读 Z200 下载记录失败:", err?.message || err);
    return [];
  } finally {
    if (db) db.close();
  }
}

/**
 * 查单条识别详情（含完整隐患 JSON，给"查看详情"用）。
 * 必须校验 user_phone === 当前 phone，防越权看别人的报告。
 */
export function getHazardReportDetail(phone, reportId) {
  if (!phone || !reportId) return null;
  if (!fs.existsSync(HAZARD_DB_PATH)) return null;
  let db;
  try {
    db = new Database(HAZARD_DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 5000");
    const row = db
      .prepare(
        `SELECT id, user_phone, scenario, scenario_label, hazard_count, report_json, created_at
         FROM reports WHERE id = ? AND user_phone = ?`
      )
      .get(reportId, phone);
    if (!row) return null;
    let hazards = [];
    try {
      hazards = JSON.parse(row.report_json);
    } catch {
      hazards = [];
    }
    return {
      id: row.id,
      source: "hazard",
      scenario: row.scenario,
      scenarioLabel: row.scenario_label || row.scenario,
      hazardCount: row.hazard_count,
      hazards,
      createdAt: row.created_at,
    };
  } catch (err) {
    console.error("[history] 读 A600 报告详情失败:", err?.message || err);
    return null;
  } finally {
    if (db) db.close();
  }
}
