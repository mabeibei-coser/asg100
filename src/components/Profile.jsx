import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, Button, Chip, Divider, Stack, CircularProgress } from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { fetchLedger } from '../utils/api';

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const yuan = (cents) => `¥${(cents / 100).toFixed(2)}`;
const LEDGER_LABEL = { activate: '开通会员', renew: '续费会员' };

/**
 * 个人中心：VIP 状态卡 + 购买记录。
 * membership 由父组件传入（已含 isVip / vipExpireAt / totalPaidCents）。
 */
export default function Profile({ membership, onBuy, onBack }) {
  const [ledger, setLedger] = useState(null);

  useEffect(() => {
    fetchLedger().then((d) => setLedger(d.ledger)).catch(() => setLedger([]));
  }, []);

  const isVip = membership?.isVip;

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a5f', textAlign: 'center', mb: 2 }}>
        个人中心
      </Typography>

      {/* VIP 状态卡 */}
      <Card
        sx={{
          p: 2.5, mb: 2, borderRadius: 2,
          background: isVip ? 'linear-gradient(135deg, #1e3a5f, #2c5282)' : '#f1f5f9',
          color: isVip ? '#fff' : '#64748b',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <WorkspacePremiumIcon sx={{ color: isVip ? '#f59e0b' : '#cbd5e1' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {isVip ? 'VIP 会员' : '普通用户'}
          </Typography>
          {isVip && <Chip label="生效中" size="small" sx={{ bgcolor: '#f59e0b', color: '#fff', height: 20 }} />}
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {isVip ? `有效期至 ${fmtDate(membership.vipExpireAt)}` : '开通 VIP 解锁台账下载、历史记录、全部文档'}
        </Typography>
        <Button
          variant="contained" size="small" onClick={onBuy}
          sx={{
            mt: 1.5, bgcolor: isVip ? 'rgba(255,255,255,0.2)' : '#1e3a5f',
            '&:hover': { bgcolor: isVip ? 'rgba(255,255,255,0.3)' : '#2c5282' },
          }}
        >
          {isVip ? '续费' : '立即开通'}
        </Button>
      </Card>

      {/* 购买记录 */}
      <Card sx={{ p: 2, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 600, color: '#1e3a5f', mb: 1 }}>购买记录</Typography>
        <Divider sx={{ mb: 1 }} />
        {ledger === null ? (
          <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} /></Box>
        ) : ledger.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center', py: 2 }}>
            暂无购买记录
          </Typography>
        ) : (
          <Stack spacing={1}>
            {ledger.map((l) => (
              <Box key={l.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                    {LEDGER_LABEL[l.type] || l.type} · {l.duration_days} 天
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>{fmtDate(l.created_at)}</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e3a5f' }}>{yuan(l.amount_cents)}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Card>

      <Button fullWidth onClick={onBack} sx={{ mt: 2, color: '#94a3b8' }}>返回</Button>
    </Box>
  );
}
