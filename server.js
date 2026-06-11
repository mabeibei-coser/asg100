import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const { default: express } = await import("express");
const { getSession } = await import("./lib/session.js");
const { getDb, upsertUserByPhone } = await import("./lib/db.js");
const bcrypt = (await import("bcryptjs")).default;
const { sendSms } = await import("./lib/smsbao.js");
const { checkSmsLimits, checkVerifyLimit, checkChargeLimits } = await import("./lib/rate-limit.js");
const { listPackages, getPackage } = await import("./lib/packages.js");
const {
  getMembership,
  ensureMembership,
  grantVipFromOrder,
  getRecentLedger,
} = await import("./lib/membership.js");
const { getHazardHistory, getHazardReportDetail, getDocDownloadHistory, getRecentHazardReports } = await import("./lib/history.js");
const { createJsapiOrder, verifyNotify } = await import("./lib/wechat-pay.js");
const {
  buildAuthorizeUrl,
  exchangeCodeForOpenid,
  isSafeFromPath,
  resolveRedirect,
} = await import("./lib/wechat-oauth.js");
const { signDownloadToken, verifyDownloadToken } = await import("./lib/download-token.js");

const PORT = Number(process.env.ASG100_API_PORT || process.env.PORT) || 4002;
const NOTIFY_PATH = "/api/pay/wechat/notify";
const OAUTH_CALLBACK_PATH = "/api/wechat/oauth/callback";
const DEV_PAY_ENABLED = process.env.NODE_ENV !== "production" || process.env.ASG_DEV_PAY === "true";

const app = express();
app.set("trust proxy", true);

// notify 路由要原始 bytes 验签，跳过全局 json；其余路由走 json。
app.use((req, res, next) => {
  if (req.path === NOTIFY_PATH) return next();
  express.json({ limit: "2mb" })(req, res, next);
});

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

// ════════════ HTML 错误页（下载流不该返 JSON，否则浏览器把 JSON 当页面渲染）════════════
// 用户在「在浏览器中打开」后跨进程访问，没 cookie → 返友好 HTML，引导回微信
function htmlPage(title, inner) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;padding:48px 24px;background:#f4f3ee;color:#1a1815;text-align:center;margin:0;min-height:100vh;box-sizing:border-box}.icon{font-size:64px;margin-bottom:16px}h1{font-size:20px;font-weight:700;margin:8px 0 16px}p{font-size:14px;line-height:1.7;color:#6b6962;max-width:320px;margin:0 auto 8px}.hint{background:#fff;border-radius:12px;padding:20px 24px;margin:24px auto;max-width:320px;text-align:left;box-shadow:0 1px 3px rgba(0,0,0,.04)}.hint p{margin:6px 0;max-width:none}.hint b{color:#0f766e}</style></head><body>${inner}</body></html>`;
}
const htmlLoginPrompt = () => htmlPage("登录已失效", `<div class="icon">🔒</div><h1>登录已失效</h1><p>下载链接已过期（10 分钟）或您未在微信内登录。</p><div class="hint"><p><b>请回到微信内重新打开：</b></p><p>1. 关闭这个浏览器标签</p><p>2. 回到微信</p><p>3. 重新进入「我的识别历史」并点击「下载台账」</p></div>`);
const htmlVipPrompt = () => htmlPage("VIP 专享", `<div class="icon">👑</div><h1>下载台账为 VIP 专享</h1><p>请回到微信内开通 VIP 后下载。</p>`);
const htmlEmptyPrompt = (days) => htmlPage("无可下载记录", `<div class="icon">📋</div><h1>最近 ${days} 天没有识别记录</h1><p>请回到微信内先做几次识别再下载。</p>`);

// ════════════ 短信验证码登录 ════════════

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
      .prepare("INSERT INTO sms_codes(phone, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .run(phone, codeHash, now + 5 * 60 * 1000, now);
    // 短信宝按「签名+正文模板」整体审核：只有报备通过的模板才会用报备签名发出，
    // 否则回退到账户默认签名（曾踩坑：asg100 自定义正文未报备 → 签名被换成【云知象限】）。
    // 与 A200 共用账户，故签名 + 正文都对齐 A200（A200 的模板已报备通过），一字不差复用其模板。
    const sign = process.env.SMSBAO_SIGN || "【谨世智能】";
    const content = `${sign}您的注册登录验证码为${code}，如非本人操作，请忽略本短信`;
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

app.post("/api/sms/verify", async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  const code = String(req.body?.code || "").trim();
  if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "请输入手机号和 6 位验证码" });
  }
  const attempt = await checkVerifyLimit(phone);
  if (!attempt.ok) {
    return res.status(429).json({ error: `验证过于频繁，请 ${attempt.retryAfterSec} 秒后再试` });
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
    ensureMembership(phone);

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
  const m = getMembership(session.phone);
  res.json({
    userId: session.userId,
    phone: session.phone,
    hasOpenid: !!session.openid,
    isVip: m.isVip,
    vipExpireAt: m.vipExpireAt,
  });
});

// ════════════ 会员状态（业务产品"刷卡"契约 + 个人中心）════════════

app.get(
  "/api/membership/me",
  requireSession(async (req, res) => {
    const m = getMembership(req.session.phone);
    res.json(m);
  })
);

app.get(
  "/api/membership/ledger",
  requireSession(async (req, res) => {
    res.json({ ledger: getRecentLedger(req.session.phone, 20) });
  })
);

// 套餐列表（公开）
app.get("/api/packages", (req, res) => {
  res.json({ packages: listPackages() });
});

// 法律文档：ASG100 登录页直接 fetch /ata100/api/legal/:type（两域共用同一份，admin-hub 统一维护）
// 故本服务不再暴露 /api/legal/:type；site_settings 表也归 ata100 独家拥有。

// ════════════ 我的历史（只读聚合各业务积木的记录）════════════

app.get(
  "/api/me/history",
  requireSession(async (req, res) => {
    const hazards = getHazardHistory(req.session.phone, 50);
    const downloads = getDocDownloadHistory(req.session.phone, 50);
    res.json({ items: hazards, downloads });
  })
);

app.get(
  "/api/me/history/hazard/:id",
  requireSession(async (req, res) => {
    const detail = getHazardReportDetail(req.session.phone, Number(req.params.id));
    if (!detail) return res.status(404).json({ error: "记录不存在" });
    res.json(detail);
  })
);

// 下载最近 N 天台账（VIP 专享）：服务端用 exceljs 生成 xlsx，并嵌入每条记录的现场照片。
// 与 A600 应用内台账同列；台账下载是 VIP 付费点（与 A600 + 会员中心文案一致）。
//
// 鉴权双轨（解决「在浏览器中打开」后跨进程 cookie 不共享 → 401 → 浏览器渲染 JSON 错误页）：
// 1) check=1 模式：必须 cookie session（前端 fetch 调，cookie 一定带）。校验通过返回签名 token。
// 2) 实际下载：?dt=<token> 优先（用户复制 URL 给浏览器，URL 自带凭证）→ cookie session 兜底。
app.get("/api/me/history/ledger", async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 3, 1), 31);
  const isCheck = req.query.check === "1";

  // 鉴权解析：token 仅在实际下载时有效（check=1 必须 cookie，保证签发安全）
  let phone = null;
  let bypassMembershipCheck = false;
  const dt = typeof req.query.dt === "string" ? req.query.dt : null;
  if (dt && !isCheck) {
    const ok = verifyDownloadToken(dt, { scope: "ledger-download", ref: `days=${days}` });
    if (ok) {
      phone = ok.phone;
      bypassMembershipCheck = true; // 签发时已校过 VIP + 有数据
    }
  }
  if (!phone) {
    const session = await getSession(req, res);
    if (!session.userId) {
      if (isCheck) return res.status(401).json({ error: "请先登录" });
      return res.status(401).send(htmlLoginPrompt());
    }
    phone = session.phone;
  }

  // VIP 校验（token 路径跳过）
  if (!bypassMembershipCheck) {
    const m = getMembership(phone);
    if (!m?.isVip) {
      if (isCheck) return res.status(403).json({ error: "开通 VIP 后可下载台账", needVip: true });
      return res.status(403).send(htmlVipPrompt());
    }
  }

  // 数据存在性
  const since = Date.now() - days * 86400000;
  const reports = getRecentHazardReports(phone, since);
  if (!reports.length) {
    if (isCheck) return res.status(404).json({ error: `最近 ${days} 天没有识别记录` });
    return res.status(404).send(htmlEmptyPrompt(days));
  }

  // check=1：返回签名 token（10 分钟内有效，前端拼到下载 URL 上）
  if (isCheck) {
    const token = signDownloadToken({ phone, scope: "ledger-download", ref: `days=${days}` });
    return res.json({ ok: true, count: reports.length, downloadToken: token });
  }
  // ─── 下面是 Excel 生成（沿用原逻辑） ───
  const fmtTime = (ts) => {
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const stripYuan = (t) => String(t || "").replace(/\s*元\s*$/, "").trim();
    const cleanFix = (t) =>
      String(t || "")
        .split("\n")
        .map((s) => s.replace(/^\d+[\.\、\s]*/, "").trim())
        .filter(Boolean)
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n");

    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("安全隐患台账");
      ws.columns = [
        { header: "日期", key: "date", width: 18 },
        { header: "场景", key: "scenario", width: 16 },
        { header: "序号", key: "idx", width: 6 },
        { header: "隐患名称", key: "name", width: 22 },
        { header: "等级", key: "level", width: 8 },
        { header: "具体描述", key: "desc", width: 40 },
        { header: "涉及规范", key: "reg", width: 26 },
        { header: "整改建议", key: "fix", width: 36 },
        { header: "预算经费", key: "budget", width: 14 },
        { header: "现场照片", key: "photo", width: 22 },
      ];
      const head = ws.getRow(1);
      head.font = { bold: true };
      head.alignment = { vertical: "middle", horizontal: "center" };
      head.height = 22;

      for (const rep of reports) {
        const hazards = Array.isArray(rep.hazards) && rep.hazards.length ? rep.hazards : [null];
        const firstRowNum = ws.rowCount + 1;
        hazards.forEach((h, i) => {
          const row = ws.addRow({
            date: fmtTime(rep.createdAt),
            scenario: rep.scenarioLabel,
            idx: h ? i + 1 : "",
            name: h ? h.hazard_name || "" : "（未发现隐患）",
            level: h && h.hazard_level ? `${h.hazard_level}风险` : "",
            desc: h ? h.hazard_description || "" : "",
            reg: h ? h.relevant_regulations || "" : "",
            fix: h ? cleanFix(h.rectification_suggestions) : "",
            budget: h ? stripYuan(h.estimated_budget) : "",
            photo: "",
          });
          row.alignment = { vertical: "top", wrapText: true };
        });
        // 现场照片：每条记录嵌一次，放在该记录首行的「现场照片」列（第 10 列，0-indexed = 9）。
        // exceljs 仅支持 png/jpeg；webp 等跳过（留空），不编造。
        if (rep.imageBase64 && /image\/(jpe?g|png)/i.test(rep.imageMime || "")) {
          const ext = /png/i.test(rep.imageMime) ? "png" : "jpeg";
          try {
            const imgId = wb.addImage({
              buffer: Buffer.from(rep.imageBase64, "base64"),
              extension: ext,
            });
            ws.getRow(firstRowNum).height = 96;
            ws.addImage(imgId, {
              tl: { col: 9, row: firstRowNum - 1 },
              ext: { width: 150, height: 110 },
              editAs: "oneCell",
            });
          } catch (e) {
            console.error("[ledger] 嵌图失败:", e?.message || e);
          }
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      const fname = `安全隐患台账_近${days}天_${fmtTime(Date.now()).replace(/[:\s-]/g, "")}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
      );
      res.send(Buffer.from(buf));
  } catch (err) {
    console.error("[ledger] 生成失败:", err);
    res.status(500).json({ error: "台账生成失败，请稍后重试" });
  }
});

// ════════════ 微信支付 ════════════

app.post(
  "/api/pay/wechat/order",
  requireSession(async (req, res) => {
    const pkg = getPackage(String(req.body?.packageId || ""));
    if (!pkg) return res.status(400).json({ error: "套餐不存在" });

    // JSAPI 必须 openid；没有就引导走 OAuth
    if (!req.session.openid) {
      const from = isSafeFromPath(req.body?.from) ? req.body.from : "/billing";
      return res.status(401).json({
        needOauth: true,
        redirectTo: `/api/wechat/oauth/init?from=${encodeURIComponent(from)}`,
      });
    }

    const ip = req.ip || "unknown";
    const limit = await checkChargeLimits(req.session.phone, ip);
    if (!limit.ok) {
      return res.status(429).json({ error: `操作过于频繁，请 ${limit.retryAfterSec} 秒后再试` });
    }

    try {
      const db = getDb();
      const now = Date.now();
      const outTradeNo = `ASG${now}${crypto.randomBytes(3).toString("hex")}`;
      db.prepare(
        `INSERT INTO orders(out_trade_no, package_id, amount_cents, duration_days, status, payer_openid, payer_phone, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
      ).run(outTradeNo, pkg.id, pkg.amountCents, pkg.durationDays, req.session.openid, req.session.phone, now);

      const order = await createJsapiOrder({
        outTradeNo,
        amountCents: pkg.amountCents,
        description: `安全隐患识别VIP-${pkg.label}`,
        notifyUrl: process.env.ASG_WECHAT_NOTIFY_URL || `http://localhost:${PORT}${NOTIFY_PATH}`,
        openid: req.session.openid,
      });
      db.prepare("UPDATE orders SET prepay_id = ? WHERE out_trade_no = ?").run(order.prepayId, outTradeNo);

      res.json({
        ok: true,
        outTradeNo,
        jsapi: order.jsapi,
        amountCents: pkg.amountCents,
        durationDays: pkg.durationDays,
        fakeMode: order.fakeMode,
      });
    } catch (err) {
      console.error("[pay/order] failed:", err);
      res.status(500).json({ error: "下单失败，请稍后重试" });
    }
  })
);

// 查单（前端支付后轮询）
app.get(
  "/api/pay/wechat/order/:outTradeNo",
  requireSession(async (req, res) => {
    const order = getDb()
      .prepare("SELECT out_trade_no, status, package_id, duration_days FROM orders WHERE out_trade_no = ? AND payer_phone = ?")
      .get(req.params.outTradeNo, req.session.phone);
    if (!order) return res.status(404).json({ error: "订单不存在" });
    res.json({ outTradeNo: order.out_trade_no, status: order.status });
  })
);

// 微信支付回调（验签要原始 bytes，单独挂 express.raw）
app.post(NOTIFY_PATH, express.raw({ type: "*/*" }), async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const result = verifyNotify(req.headers, rawBody);
  if (!result.ok) {
    console.error("[pay/notify] verify failed:", result.reason, result.detail || "");
    const status = result.reason === "no-config" ? 500 : 401;
    return res.status(status).json({ code: "FAIL", message: result.reason });
  }
  try {
    const db = getDb();
    const { outTradeNo, tradeState } = result.resource;
    if (tradeState !== "SUCCESS") {
      return res.status(200).json({ code: "SUCCESS", message: "OK" }); // 非成功也回 200，避免微信重推
    }
    const order = db.prepare("SELECT out_trade_no, status FROM orders WHERE out_trade_no = ?").get(outTradeNo);
    if (!order) {
      console.error("[pay/notify] order not found:", outTradeNo);
      return res.status(200).json({ code: "SUCCESS", message: "OK" });
    }
    if (order.status !== "paid") {
      db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE out_trade_no = ?").run(Date.now(), outTradeNo);
    }
    grantVipFromOrder(outTradeNo); // 幂等：同订单只开通 1 次
    res.status(200).json({ code: "SUCCESS", message: "OK" });
  } catch (err) {
    console.error("[pay/notify] handle failed:", err);
    res.status(500).json({ code: "FAIL", message: "internal" });
  }
});

// 本地模拟支付成功（fake mode 联调用；生产默认禁用）
app.post(
  "/api/dev/mock-paid",
  requireSession(async (req, res) => {
    if (!DEV_PAY_ENABLED) return res.status(403).json({ error: "dev mock 已禁用" });
    const outTradeNo = String(req.body?.outTradeNo || "");
    const db = getDb();
    const order = db
      .prepare("SELECT out_trade_no, status, payer_phone FROM orders WHERE out_trade_no = ?")
      .get(outTradeNo);
    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.payer_phone !== req.session.phone) return res.status(403).json({ error: "无权操作此订单" });
    if (order.status !== "paid") {
      db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE out_trade_no = ?").run(Date.now(), outTradeNo);
    }
    const r = grantVipFromOrder(outTradeNo);
    res.json({ ok: true, applied: r.applied, vipExpireAt: r.vipExpireAt });
  })
);

// ════════════ 微信 OAuth（拿 openid）════════════

app.get(
  "/api/wechat/oauth/init",
  requireSession(async (req, res) => {
    const from = isSafeFromPath(req.query.from) ? req.query.from : "/billing";
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    req.session.oauthFrom = from;
    await req.session.save();
    const redirectUri = process.env.ASG_OAUTH_REDIRECT_URI || OAUTH_CALLBACK_PATH;
    res.redirect(buildAuthorizeUrl(redirectUri, state));
  })
);

app.get(
  "/api/wechat/oauth/callback",
  requireSession(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
      return res.status(400).send("OAuth state 校验失败，请重试");
    }
    try {
      const { openid } = await exchangeCodeForOpenid(String(code));
      req.session.openid = openid;
      const from = isSafeFromPath(req.session.oauthFrom) ? req.session.oauthFrom : "/billing";
      req.session.oauthState = undefined;
      req.session.oauthFrom = undefined;
      await req.session.save();
      // 子路径部署：相对回跳必须补 /asg100 前缀，否则跳到根域名邻居应用 → 404
      res.redirect(resolveRedirect(from));
    } catch (err) {
      console.error("[oauth/callback] failed:", err);
      res.status(500).send("微信授权失败，请重试");
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
    console.log(`[asg100] 会员中心 api on http://localhost:${PORT}`);
  } catch (err) {
    console.error("[asg100] DB 初始化失败:", err);
  }
});
