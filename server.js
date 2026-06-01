import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const { default: express } = await import("express");
const { getSession } = await import("./lib/session.js");
const { getDb, upsertUserByPhone, insertReport } = await import("./lib/db.js");
const { buildSystemPrompt, parseResult, SCENARIO_LABELS } = await import("./lib/prompts.js");
const bcrypt = (await import("bcryptjs")).default;
const { sendSms } = await import("./lib/smsbao.js");
const { checkSmsLimits, checkVerifyLimit } = await import("./lib/rate-limit.js");

const PORT = Number(process.env.ASG100_API_PORT || process.env.PORT) || 4002;
const IFLYTEK_URL =
  process.env.IFLYTEK_API_URL ||
  "https://maas-coding-api.cn-huabei-1.xf-yun.com/v2/chat/completions";
const IFLYTEK_API_KEY = process.env.IFLYTEK_API_KEY;
const IFLYTEK_MODEL = process.env.IFLYTEK_MODEL || "astron-code-latest";

const app = express();
app.set("trust proxy", true);
// 图片 base64（压缩到 1024px / quality 0.8 后约 200-500KB，留足余量）
app.use(express.json({ limit: "12mb" }));

const PHONE_RE = /^1\d{10}$/;

function requireSession(handler) {
  return async (req, res) => {
    const session = await getSession(req, res);
    if (!session.userId) {
      return res.status(401).json({ error: "请先登录" });
    }
    req.session = session;
    return handler(req, res);
  };
}

// ── 短信验证码：发码（限频 + bcrypt 存码 + 5min 过期）──

app.post("/api/sms/send", async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: "请输入有效的 11 位手机号" });
  }
  const ip = req.ip || "unknown";
  const limit = await checkSmsLimits(phone, ip);
  if (!limit.ok) {
    const tip =
      limit.layer === "phone"
        ? `请求过于频繁，请 ${limit.retryAfterSec} 秒后再试`
        : "发送次数过多，请稍后再试";
    return res.status(429).json({ error: tip });
  }
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const now = Date.now();
    getDb()
      .prepare(
        "INSERT INTO sms_codes(phone, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(phone, codeHash, now + 5 * 60 * 1000, now);
    const content = `【谨世智能】您的验证码是 ${code}，5 分钟内有效。如非本人操作请忽略。`;
    const sent = await sendSms(phone, content);
    if (!sent.ok) {
      return res.status(502).json({ error: `验证码发送失败：${sent.msg}` });
    }
    res.json({ ok: true, dev: sent.code === "DEV" });
  } catch (err) {
    console.error("[sms/send] failed:", err);
    res.status(500).json({ error: "验证码发送失败，请稍后重试" });
  }
});

// ── 短信验证码：验码 + 登录（验成功即注册/登录，并建会员行）──

app.post("/api/sms/verify", async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  const code = String(req.body?.code || "").trim();
  if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "请输入手机号和 6 位验证码" });
  }
  const attempt = await checkVerifyLimit(phone);
  if (!attempt.ok) {
    return res
      .status(429)
      .json({ error: `验证过于频繁，请 ${attempt.retryAfterSec} 秒后再试` });
  }
  try {
    const db = getDb();
    const now = Date.now();
    const master = process.env.MASTER_OTP_CODE || "";

    if (master && code === master) {
      // 本地联调旁路：仅当 .env.local 配了 MASTER_OTP_CODE 时生效，上线必须留空
    } else {
      const row = db
        .prepare(
          "SELECT * FROM sms_codes WHERE phone = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
        )
        .get(phone, now);
      if (!row) {
        return res.status(400).json({ error: "验证码已过期或不存在，请重新获取" });
      }
      if (row.attempts >= 5) {
        return res.status(400).json({ error: "验证码错误次数过多，请重新获取" });
      }
      const ok = await bcrypt.compare(code, row.code_hash);
      if (!ok) {
        db.prepare("UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
        return res.status(400).json({ error: "验证码错误" });
      }
      db.prepare("UPDATE sms_codes SET used = 1 WHERE id = ?").run(row.id);
    }

    const userId = upsertUserByPhone(phone);
    // 新用户建会员行（时间制 VIP，初始未开通；INSERT OR IGNORE 幂等，老用户跳过）
    db.prepare(
      "INSERT OR IGNORE INTO memberships(phone, vip_expire_at, total_paid_cents, updated_at) VALUES (?, 0, 0, ?)"
    ).run(phone, now);

    const session = await getSession(req, res);
    session.userId = userId;
    session.phone = phone;
    session.loggedInAt = now;
    await session.save();
    res.json({ ok: true, userId, phone });
  } catch (err) {
    console.error("[sms/verify] failed:", err);
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
});

app.post("/api/logout", async (req, res) => {
  const session = await getSession(req, res);
  await session.destroy();
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const session = await getSession(req, res);
  if (!session.userId) return res.status(401).json({ error: "未登录" });
  res.json({ userId: session.userId, phone: session.phone });
});

// ── 隐患识别：调讯飞 multimodal + 入库（一次性原子）──

app.post(
  "/api/analyze",
  requireSession(async (req, res) => {
    const { scenario, imageBase64, mimeType } = req.body || {};
    if (!scenario || typeof scenario !== "string") {
      return res.status(400).json({ error: "缺少 scenario" });
    }
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "缺少图片数据" });
    }
    if (!IFLYTEK_API_KEY) {
      return res.status(500).json({ error: "服务器未配置 AI API key" });
    }

    const mime = mimeType && /^image\/(jpe?g|png|webp)$/.test(mimeType) ? mimeType : "image/jpeg";
    const startedAt = Date.now();

    try {
      const upstream = await fetch(IFLYTEK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${IFLYTEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: IFLYTEK_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt(scenario) },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } },
                { type: "text", text: "请按照 system prompt 中的检查清单，分析这张照片中能够直接看出的安全隐患。" },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        console.error("[analyze] iFlytek HTTP", upstream.status, text.slice(0, 300));
        return res.status(502).json({ error: `AI 请求失败 (${upstream.status})` });
      }

      const result = await upstream.json();
      const content = result?.choices?.[0]?.message?.content;
      if (!content) {
        return res.status(502).json({ error: "AI 返回内容为空" });
      }

      const hazards = parseResult(content);
      const durationMs = Date.now() - startedAt;

      const reportId = insertReport({
        userId: req.session.userId,
        userPhone: req.session.phone,
        createdAt: Date.now(),
        scenario,
        scenarioLabel: SCENARIO_LABELS[scenario] || scenario,
        hazardCount: hazards.length,
        report: hazards,
        durationMs,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        imageBase64,
        imageMime: mime,
      });

      res.json({ ok: true, reportId, hazards, durationMs });
    } catch (err) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        return res.status(504).json({ error: "请求超时（120秒），请稍后重试" });
      }
      console.error("[analyze] failed:", err);
      res.status(500).json({ error: "识别失败，请稍后重试" });
    }
  })
);

// ── 生产模式：托管 dist/ 静态资源 ──
if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => {
  try {
    getDb();
    console.log(`[asg100] api server on http://localhost:${PORT}`);
  } catch (err) {
    console.error("[asg100] DB 初始化失败:", err);
  }
});
