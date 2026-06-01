import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, Button, Alert, CircularProgress, Chip, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { fetchPackages, createOrder, mockPaid, invokeWechatPay, queryOrder } from '../utils/api';

const yuan = (cents) => `¥${(cents / 100).toFixed(2)}`;

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

  useEffect(() => {
    fetchPackages()
      .then((d) => {
        setPackages(d.packages);
        const rec = d.packages.find((p) => p.badge === '推荐') || d.packages[0];
        setSelected(rec?.id || null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const handlePay = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const order = await createOrder(selected, '/billing');
      try {
        await invokeWechatPay(order.jsapi); // 微信内：真调起
        await pollUntilPaid(order.outTradeNo);
      } catch (wxErr) {
        // 非微信环境或 fake mode：本地模拟支付成功
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
        // 需要微信授权拿 openid（真微信环境）
        window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${err.data.redirectTo}`;
        return;
      }
      setError(err.message || '支付失败');
    } finally {
      setLoading(false);
    }
  };

  const pollUntilPaid = async (outTradeNo) => {
    for (let i = 0; i < 10; i++) {
      const r = await queryOrder(outTradeNo);
      if (r.status === 'paid') return;
      await new Promise((res) => setTimeout(res, 1000));
    }
  };

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a5f', textAlign: 'center', mb: 0.5 }}>
        开通 VIP 会员
      </Typography>
      <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', mb: 3 }}>
        VIP 可下载隐患台账、查看历史记录、解锁全部安防文档
      </Typography>

      <Stack spacing={1.5}>
        {packages.map((p) => {
          const active = selected === p.id;
          return (
            <Card
              key={p.id}
              onClick={() => setSelected(p.id)}
              sx={{
                p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', border: active ? '2px solid #1e3a5f' : '2px solid #e2e8f0',
                boxShadow: active ? '0 4px 12px rgba(30,58,95,0.15)' : 'none', transition: 'all .15s',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircleIcon sx={{ color: active ? '#1e3a5f' : '#cbd5e1', fontSize: 22 }} />
                <Box>
                  <Typography sx={{ fontWeight: 600, color: '#1e3a5f' }}>
                    {p.label}
                    {p.badge && (
                      <Chip label={p.badge} size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem', bgcolor: '#f59e0b', color: '#fff' }} />
                    )}
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontWeight: 700, color: '#1e3a5f', fontSize: '1.1rem' }}>{yuan(p.amountCents)}</Typography>
            </Card>
          );
        })}
      </Stack>

      {info && <Alert severity="info" sx={{ mt: 2 }}>{info}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <Button
        fullWidth variant="contained" onClick={handlePay} disabled={!selected || loading}
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
        sx={{ mt: 3, py: 1.5, background: '#1e3a5f', '&:hover': { background: '#2c5282' } }}
      >
        {loading ? '处理中...' : '立即开通'}
      </Button>
      <Button fullWidth onClick={onBack} disabled={loading} sx={{ mt: 1, color: '#94a3b8' }}>
        返回
      </Button>
    </Box>
  );
}
