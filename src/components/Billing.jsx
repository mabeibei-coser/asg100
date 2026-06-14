import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Alert, CircularProgress, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { fetchPackages, createOrder, mockPaid, invokeWechatPay, queryOrder } from '../utils/api';
import PageHead from './PageHead';
import VipCompareTable from './VipCompareTable';

const yuan = (cents) => `¥${(cents / 100).toFixed(2)}`;
// 计算月均价格，给用户直观感
const perMonth = (cents, days) => {
  const months = Math.max(1, days / 30);
  return `¥${(cents / 100 / months).toFixed(0)}/月`;
};
/**
 * 开通 VIP 页：展示套餐 → 选中 → 调起微信支付。
 * 微信内走真 JSAPI；非微信环境（本地/桌面）走 fake mode + mock-paid 联调。
 * 支付成功回调 onPaid() 让父组件刷新会员状态。
 */
export default function Billing({ onPaid, onBack }) {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  // OAuth 回跳后由 ?autoPay=<id> 续触发支付；用 ref 避免 React 严格模式 effect 重复执行而重发单。
  const autoPayFiredRef = useRef(false);

  useEffect(() => {
    fetchPackages()
      .then((d) => {
        setPackages(d.packages);
        // OAuth 回跳带 ?autoPay=<id>：选中对应套餐并立即续起支付（避免用户点第二次）
        const params = new URLSearchParams(window.location.search);
        const autoPayId = params.get('autoPay');
        const matched = autoPayId && d.packages.find((p) => p.id === autoPayId);
        if (matched && !autoPayFiredRef.current) {
          autoPayFiredRef.current = true;
          setSelected(matched.id);
          // 清掉 URL 上的 autoPay，防止刷新页面又触发一次
          params.delete('autoPay');
          const search = params.toString();
          window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''));
          handlePayFor(matched.id);
        } else {
          const rec = d.packages.find((p) => p.id === 'pkg_12m') || d.packages[0];
          setSelected(rec?.id || null);
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 真正发起支付的核心逻辑；接受 packageId 入参，让 OAuth 回跳后能用 URL 上的 id 直接续起来。
  const handlePayFor = async (packageId) => {
    if (!packageId || loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const order = await createOrder(packageId, '/billing');
      try {
        await invokeWechatPay(order.jsapi); // 微信内：真调起
        await pollUntilPaid(order.outTradeNo);
      } catch (wxErr) {
        if (order.fakeMode || wxErr.message === 'NOT_IN_WECHAT') {
          setInfo('当前为开发模式，模拟支付成功…');
          await mockPaid(order.outTradeNo);
        } else {
          throw wxErr;
        }
      }
      onPaid?.();
    } catch (err) {
      if (err.status === 401 && err.data?.needOauth) {
        // 跳 OAuth 前把 packageId 写进 from，回跳后挂载时自动续支付，免用户再点一次
        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        const from = encodeURIComponent(`/billing?autoPay=${encodeURIComponent(packageId)}`);
        window.location.href = `${base}/api/wechat/oauth/init?from=${from}`;
        return;
      }
      setError(err.message || '支付失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = () => handlePayFor(selected);

  const pollUntilPaid = async (outTradeNo) => {
    for (let i = 0; i < 10; i++) {
      const r = await queryOrder(outTradeNo);
      if (r.status === 'paid') return;
      await new Promise((res) => setTimeout(res, 1000));
    }
  };

  const selectedPkg = packages.find((p) => p.id === selected);

  return (
    <Box className="subpage-content billing-page" sx={{ maxWidth: 540, mx: 'auto' }}>
      <PageHead
        title="选择套餐"
        onBack={onBack}
      />

      {/* 信任元素：微信支付 + 加密 + 即时生效 */}
      <Box sx={{
        mb: 1.5,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 1.1, sm: 2 },
        rowGap: 0.75,
      }}>
        <Trust icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />} text="微信支付加密" />
        <Trust icon={<BoltOutlinedIcon sx={{ fontSize: 14 }} />} text="支付后立即生效" />
        <Trust icon={<VerifiedOutlinedIcon sx={{ fontSize: 14 }} />} text="10万+会员" />
      </Box>

      <Stack spacing={0.85} sx={{ mb: 2 }}>
        {packages.map((p) => {
          const active = selected === p.id;
          return (
            <Box
              key={p.id}
              onClick={() => setSelected(p.id)}
              role="radio"
              aria-checked={active}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p.id); } }}
              sx={{
                position: 'relative',
                p: { xs: 1.15, sm: 1.35 },
                pl: { xs: 1.25, sm: 1.45 },
                minHeight: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.25,
                cursor: 'pointer',
                borderRadius: '10px',
                background: active
                  ? 'linear-gradient(90deg, #fffaf0 0%, #fff5dd 100%)'
                  : 'var(--bg-elev)',
                border: '1px solid',
                borderColor: active ? 'rgba(176, 138, 62, 0.58)' : 'var(--line)',
                boxShadow: active
                  ? '0 6px 16px rgba(176, 138, 62, 0.10)'
                  : 'none',
                transition: 'all .2s cubic-bezier(0.2, 0.7, 0.2, 1)',
                '&:hover': {
                  borderColor: active ? 'rgba(176, 138, 62, 0.58)' : 'rgba(12, 114, 83, 0.26)',
                  transform: active ? 'none' : 'translateY(-1px)',
                  boxShadow: active
                    ? '0 6px 16px rgba(176, 138, 62, 0.10)'
                    : '0 6px 14px rgba(15, 118, 110, 0.06)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.15, minWidth: 0 }}>
                <CheckCircleIcon sx={{
                  color: active ? 'var(--gold)' : 'var(--ink-4)',
                  fontSize: 20,
                  flexShrink: 0,
                  transition: 'color .18s ease',
                }} />
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {p.label.replace(/\s+/g, '')}
                    </Box>
                  </Box>
                  {p.durationDays > 30 && (
                    <Box className="num" sx={{
                      fontSize: '0.72rem',
                      color: active ? 'var(--gold)' : 'var(--ink-3)',
                      mt: 0.25, fontWeight: 600,
                    }}>
                      {perMonth(p.amountCents, p.durationDays)}
                    </Box>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, minWidth: 92 }}>
                {p.badge && (
                  <Box sx={{
                    mb: 0.35,
                    px: 0.65,
                    py: 0.18,
                    fontSize: '0.6rem',
                    fontWeight: 750,
                    lineHeight: 1,
                    borderRadius: '6px',
                    background: 'rgba(176, 138, 62, 0.12)',
                    color: 'var(--gold)',
                    border: '1px solid rgba(176, 138, 62, 0.20)',
                  }}>
                    {p.badge}
                  </Box>
                )}
                <Box className="num" sx={{
                  fontSize: '1.18rem',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                  lineHeight: 1.1,
                }}>
                  {yuan(p.amountCents)}
                </Box>
                {p.originalAmountCents && p.originalAmountCents > p.amountCents && (
                  <Box className="num" sx={{
                    mt: 0.35,
                    fontSize: '1rem',
                    color: 'var(--gold)',
                    fontWeight: 800,
                    textDecoration: 'line-through',
                    textDecorationThickness: '1px',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}>
                    {yuan(p.originalAmountCents)}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>

      {info && <Alert severity="info" sx={{ mb: 2, borderRadius: 'var(--r-sm)' }}>{info}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--r-sm)' }}>{error}</Alert>}

      {/* CTA：金色付费按钮 */}
      <Button
        variant="contained"
        fullWidth
        onClick={handlePay}
        disabled={!selected || loading}
        disableElevation
        className="btn-gold"
        startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
        sx={{
          py: 1.5,
          fontSize: '1rem',
          fontWeight: 700,
          borderRadius: 'var(--r-sm)',
          textTransform: 'none',
          background: 'linear-gradient(180deg, #c6a052 0%, #a77f2e 100%)',
          color: '#fff',
          boxShadow: '0 8px 22px rgba(168, 128, 47, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
          '&:hover': { background: 'linear-gradient(180deg, #c9a050 0%, #a8802f 100%)' },
        }}
      >
        {loading
          ? '处理中…'
          : selectedPkg
          ? `立即支付 ${yuan(selectedPkg.amountCents)} · 开通 VIP`
          : '立即支付'}
      </Button>

      {/* VIP Hero：金色光晕 + 大标题 + 普通 vs VIP 对比表（移到付款按钮下方作为佐证） */}
      <VipCompareTable />

    </Box>
  );
}

function Trust({ icon, text }) {
  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      fontSize: '0.72rem',
      color: 'var(--ink-3)',
      letterSpacing: '0.01em',
    }}>
      <Box sx={{ display: 'inline-flex', color: 'var(--ink-3)' }}>{icon}</Box>
      {text}
    </Box>
  );
}
