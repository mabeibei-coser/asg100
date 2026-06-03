/**
 * asg100 会员中心 API 客户端
 * 浏览器 → /api/* → Express 会员中心（短信登录 / 微信支付 / VIP / 个人中心）
 */

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

async function http(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `请求失败 (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ── 账号 ──
export async function fetchMe() {
  try {
    return await http('GET', '/me');
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}
export const sendSmsCode = (phone) => http('POST', '/sms/send', { phone });
export const verifySmsCode = (phone, code) => http('POST', '/sms/verify', { phone, code });
export const logout = () => http('POST', '/logout');

// ── 会员 ──
export const fetchMembership = () => http('GET', '/membership/me');
export const fetchLedger = () => http('GET', '/membership/ledger');
export const fetchPackages = () => http('GET', '/packages');

// ── 我的历史 ──
export const fetchHistory = () => http('GET', '/me/history');
export const fetchHazardDetail = (id) => http('GET', `/me/history/hazard/${id}`);

/**
 * 预检 + 拿签名 URL：挂载时在微信内（cookie 已登录态）调用，服务端返回签名 token。
 * 拼成的下载 URL 自带凭证、10 分钟内有效，用户用「在浏览器中打开」跳过去也能下载。
 * 返回 { ok: true, count, downloadUrl } | { ok: false, reason: 'forbidden' | 'empty' | 'error' }。
 */
export async function checkLedger(days = 3) {
  try {
    const res = await fetch(`${API_BASE}/me/history/ledger?days=${days}&check=1`, {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const token = data.downloadToken;
      const downloadUrl = token
        ? `${API_BASE}/me/history/ledger?days=${days}&dt=${encodeURIComponent(token)}`
        : null;
      return { ok: true, count: data.count || 0, downloadUrl };
    }
    if (res.status === 403) return { ok: false, reason: 'forbidden' };
    if (res.status === 404) return { ok: false, reason: 'empty' };
    return { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * 触发下载：必须在用户手势同步上下文内调用（onClick 直接调，不能在 await 之后调）。
 * URL 应预先通过 checkLedger() 拿到（签名 URL，跨进程友好）。
 */
export function triggerLedgerDownload(url) {
  window.location.href = url;
}

// ── 支付 ──
// 下单。返回 { outTradeNo, jsapi, fakeMode } 或抛 needOauth 错误（401，data.redirectTo）。
export const createOrder = (packageId, from = '/') => http('POST', '/pay/wechat/order', { packageId, from });
export const queryOrder = (outTradeNo) => http('GET', `/pay/wechat/order/${outTradeNo}`);
// 本地 fake 模式：模拟支付成功（生产禁用）
export const mockPaid = (outTradeNo) => http('POST', '/dev/mock-paid', { outTradeNo });

/**
 * 调起微信 JSAPI 支付。微信内有 WeixinJSBridge → 真调起；否则 reject（前端走 fake 分支）。
 */
export function invokeWechatPay(jsapi) {
  return new Promise((resolve, reject) => {
    const invoke = () => {
      window.WeixinJSBridge.invoke(
        'getBrandWCPayRequest',
        {
          appId: jsapi.appId,
          timeStamp: jsapi.timeStamp,
          nonceStr: jsapi.nonceStr,
          package: jsapi.package,
          signType: jsapi.signType,
          paySign: jsapi.paySign,
        },
        (r) => {
          if (r.err_msg === 'get_brand_wcpay_request:ok') resolve();
          else reject(new Error(r.err_msg || '支付取消'));
        }
      );
    };
    // 微信里 WeixinJSBridge 是异步注入的，页面刚打开那几秒还是 undefined。
    // 直接判 undefined 会把"还没注入完"误当成"不在微信"——首次点击被踢去 fake 分支、
    // 表现为没反应，过几秒 bridge 就绪后第二次点才成功（即"需点两下"）。
    if (typeof window.WeixinJSBridge !== 'undefined') {
      invoke();
    } else if (/MicroMessenger/i.test(navigator.userAgent)) {
      // 在微信内但 bridge 尚未就绪 → 等就绪事件再调起
      document.addEventListener('WeixinJSBridgeReady', invoke, { once: true });
    } else {
      // 真正的非微信环境（桌面 / 本地联调）→ 让前端走 fake 分支
      reject(new Error('NOT_IN_WECHAT'));
    }
  });
}

export default {
  fetchMe, sendSmsCode, verifySmsCode, logout,
  fetchMembership, fetchLedger, fetchPackages,
  createOrder, queryOrder, mockPaid, invokeWechatPay,
};
