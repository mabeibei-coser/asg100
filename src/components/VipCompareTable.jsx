import React from 'react';
import { Box } from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';

// 普通用户 vs VIP 权限对比。支付页和个人中心共用，避免两处权益文案漂移。
const COMPARE_ROWS = [
  { k: '隐患识别', free: '√', vip: '√' },
  { k: '35个场景', free: '基础能力', vip: '专项能力' },
  { k: '台账复制', free: '√', vip: '√' },
  { k: '台账下载', free: '×', vip: '导出Excel+照片' },
  { k: '历史查询', free: '×', vip: '√' },
  { k: '文档查询', free: '仅预览', vip: '无限下载' },
  { k: 'AI通道', free: '标准通道', vip: '高速通道' },
  { k: '日限额', free: '30次/天', vip: '100次/天' },
];

export default function VipCompareTable({ sx }) {
  return (
    <Box className="vip-hero" sx={{ p: { xs: 2.5, md: 3 }, mt: 3, mb: 2, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 'var(--r-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(180deg, #d6b25c 0%, #a8802f 100%)',
          color: '#fff',
          boxShadow: '0 6px 16px rgba(168, 128, 47, 0.32), inset 0 1px 0 rgba(255,255,255,0.28)',
          flexShrink: 0,
        }}>
          <WorkspacePremiumIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box>
          <Box className="h-eyebrow" sx={{ color: 'var(--gold)', mb: 0.4 }}>
            asg100 vip
          </Box>
          <Box className="h-display" sx={{ fontSize: '1.35rem', lineHeight: 1.15 }}>
            解锁隐患台账与文档库
          </Box>
        </Box>
      </Box>

      <Box sx={{
        borderRadius: 'var(--r-sm)',
        border: '1px solid rgba(176, 138, 62, 0.28)',
        background: 'var(--bg-elev)',
        overflow: 'hidden',
        position: 'relative', zIndex: 1,
      }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 0.9fr 1.1fr',
          background: 'rgba(176, 138, 62, 0.10)',
          fontSize: '0.74rem',
          fontWeight: 700,
          letterSpacing: '0.01em',
        }}>
          <Box sx={{ px: 1.4, py: 0.95, color: 'var(--ink-2)' }}>权益</Box>
          <Box sx={{ px: 1.2, py: 0.95, textAlign: 'center', color: 'var(--ink-3)' }}>普通用户</Box>
          <Box sx={{ px: 1.2, py: 0.95, textAlign: 'center', color: 'var(--gold)' }}>VIP 用户</Box>
        </Box>
        {COMPARE_ROWS.map((row) => (
          <Box key={row.k} sx={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 0.9fr 1.1fr',
            borderTop: '1px solid var(--line)',
            fontSize: '0.78rem',
            alignItems: 'center',
          }}>
            <Box sx={{ px: 1.4, py: 0.95, color: 'var(--ink)', fontWeight: 600 }}>{row.k}</Box>
            <Box sx={{ px: 1.2, py: 0.95, textAlign: 'center', color: 'var(--ink-3)' }}>{row.free}</Box>
            <Box sx={{
              px: 1.2, py: 0.95, textAlign: 'center',
              color: 'var(--gold)', fontWeight: 650,
              background: 'rgba(176, 138, 62, 0.05)',
            }}>{row.vip}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
