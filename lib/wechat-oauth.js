// 微信公众号网页授权（OAuth 2.0）—— 搬自 A200 lib/wechat-oauth.ts，去 TS。
//
// 用途：JSAPI 下单必须传 payer.openid，openid 通过网页授权拿。
// scope = snsapi_base（静默授权，不弹确认页；只拿 openid）。
//
// 流程：
// 1. 用户进购买页，session 没 openid → location.replace("/api/wechat/oauth/init?from=/billing")
// 2. init 路由：gen state → 写 cookie → 302 微信授权页(buildAuthorizeUrl)
// 3. 微信回调 /api/wechat/oauth/callback?code=xxx&state=yyy
// 4. callback：验 state → exchangeCodeForOpenid → 写 session.openid → 302 回 from
//
// fake mode（env 不全）：buildAuthorizeUrl 直接跳本地 callback?code=FAKE_CODE_xxx，
// exchangeCodeForOpenid 返 FAKE_OPENID_XXX，本地无公众号也能跑通完整链路。

const WX_AUTHORIZE_BASE = "https://open.weixin.qq.com/connect/oauth2/authorize";
const WX_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";

/** 公众号配置是否齐全（决定是否 fake mode）。 */
export function isOAuthReady() {
  return (
    !!process.env.WECHAT_OFFICIAL_ACCOUNT_APPID &&
    !!process.env.WECHAT_OFFICIAL_ACCOUNT_SECRET
  );
}

/**
 * 拼接微信授权页 URL。
 * @param {string} redirectUri 微信回调到的完整 https URL
 * @param {string} state 防 CSRF 随机串
 */
export function buildAuthorizeUrl(redirectUri, state) {
  const appid =
    process.env.WECHAT_OFFICIAL_ACCOUNT_APPID ?? process.env.WECHAT_PAY_APP_ID;
  if (!appid) {
    // fake mode：直接跳本地 callback 模拟微信回跳
    const params = new URLSearchParams({ code: `FAKE_CODE_${Date.now()}`, state });
    return `${redirectUri}?${params.toString()}`;
  }
  const params = new URLSearchParams({
    appid,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_base",
    state,
  });
  return `${WX_AUTHORIZE_BASE}?${params.toString()}#wechat_redirect`;
}

/**
 * 用 code 换 openid。
 * env 不全或 code 以 FAKE_CODE_ 开头 → fake mode，返假 openid。
 */
export async function exchangeCodeForOpenid(code) {
  if (!isOAuthReady() || code.startsWith("FAKE_CODE_")) {
    console.warn("[wechat-oauth] fake mode: env 不全或 code 是 FAKE。配齐 env 即可切真。");
    return { openid: `FAKE_OPENID_${Date.now().toString(36)}`, fakeMode: true };
  }
  const appid = process.env.WECHAT_OFFICIAL_ACCOUNT_APPID;
  const secret = process.env.WECHAT_OFFICIAL_ACCOUNT_SECRET;
  const params = new URLSearchParams({
    appid,
    secret,
    code,
    grant_type: "authorization_code",
  });
  const resp = await fetch(`${WX_TOKEN_URL}?${params.toString()}`, { method: "GET" });
  if (!resp.ok) {
    throw new Error(`微信 OAuth code 交换 HTTP 失败 status=${resp.status}`);
  }
  const data = await resp.json();
  if ("errcode" in data) {
    throw new Error(`微信 OAuth code 交换失败 errcode=${data.errcode} errmsg=${data.errmsg}`);
  }
  if (!data.openid) {
    throw new Error(`微信 OAuth 返回缺 openid: ${JSON.stringify(data)}`);
  }
  return { openid: data.openid, accessToken: data.access_token, fakeMode: false };
}

/** OAuth state(防 CSRF)的 cookie 名 */
export const OAUTH_STATE_COOKIE = "wx_oauth_state";
/** OAuth state cookie TTL（秒）；5 分钟 */
export const OAUTH_STATE_TTL = 60 * 5;

/** 校验 from 只能是本站内部相对路径，防 open redirect。 */
export function isSafeFromPath(from) {
  if (typeof from !== "string") return false;
  if (!from.startsWith("/")) return false;
  if (from.startsWith("//")) return false;
  if (from.includes("\n") || from.includes("\r")) return false;
  return true;
}
