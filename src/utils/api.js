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
    if (typeof window.WeixinJSBridge === 'undefined') {
      reject(new Error('NOT_IN_WECHAT'));
      return;
    }
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
  });
}

export default {
  fetchMe, sendSmsCode, verifySmsCode, logout,
  fetchMembership, fetchLedger, fetchPackages,
  createOrder, queryOrder, mockPaid, invokeWechatPay,
};
