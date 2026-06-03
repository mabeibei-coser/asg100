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

// 微信内置 WebView 会静默拦截 Content-Disposition: attachment 的导航
// （表现为「按钮按了像没按一样」），下载入口要先检测、改成引导用户「右上角→在浏览器打开」。
export function isWeixinBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

/**
 * 下载最近 N 天台账（Excel，含现场照片）。VIP 专享。
 * 两步：先 fetch ?check=1 拿 403 needVip / 404 无记录的 JSON 提示；通过后跳真实 URL 让浏览器原生下载。
 * 之前用 fetch+blob URL 在微信 WebView 不兼容（blob 跨进程失效）；
 * 现在 attachment 头由 HTTP URL 直接触发，外部浏览器打开同一 URL 也能正确下载。
 * 微信内（MicroMessenger）attachment 跳转会被静默拦截，应在调用方先用 isWeixinBrowser 拦截 + 引导用户。
 */
export async function downloadHistoryLedger(days = 3) {
  // 步骤 1：预检——保留原有的 403/404 提示 UX
  const check = await fetch(`${API_BASE}/me/history/ledger?days=${days}&check=1`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!check.ok) {
    let data = {};
    try { data = await check.json(); } catch { /* 非 JSON 错误体 */ }
    const err = new Error(data?.error || `下载失败 (${check.status})`);
    err.status = check.status;
    err.data = data;
    throw err;
  }
  // 步骤 2：通过后跳真实 HTTP URL，浏览器原生处理（attachment 头触发下载）
  window.location.href = `${API_BASE}/me/history/ledger?days=${days}`;
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
