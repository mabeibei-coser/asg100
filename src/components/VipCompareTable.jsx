import React from 'react';
import { Box } from '@mui/material';

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
    <Box sx={{
      mt: 3,
      mb: 2,
      p: { xs: 1, md: 1.25 },
      borderRadius: '16px',
      border: '1px solid var(--report-border, rgba(15, 23, 42, 0.10))',
      background: '#fff',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03), 0 2px 8px rgba(15, 23, 42, 0.03)',
      ...sx,
    }}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 0.95fr 1.25fr',
        px: 1,
        py: 0.5,
        color: 'var(--report-ink-muted, var(--ink-3))',
        fontSize: '0.69rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}>
        <Box>权益</Box>
        <Box sx={{ textAlign: 'center' }}>普通用户</Box>
        <Box sx={{ textAlign: 'right', color: 'var(--gold)' }}>VIP 用户</Box>
      </Box>

      <Box sx={{
        display: 'grid',
        gap: 0.75,
        overflow: 'hidden',
      }}>
        {COMPARE_ROWS.map((row) => (
          <Box key={row.k} sx={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 0.95fr 1.25fr',
            alignItems: 'center',
            minHeight: 36,
            borderRadius: '6px',
            background: '#fff',
            boxShadow: '0 0 0 1px var(--report-border, rgba(15, 23, 42, 0.09))',
            overflow: 'hidden',
            fontSize: '0.78rem',
          }}>
            <Box sx={{ px: 1.1, py: 1, color: 'var(--navy-900, var(--ink))', fontWeight: 650, minWidth: 0 }}>{row.k}</Box>
            <Box sx={{ px: 0.9, py: 1, textAlign: 'center', color: 'var(--report-ink-muted, var(--ink-3))', minWidth: 0 }}>{row.free}</Box>
            <Box sx={{
              px: 0.9,
              py: 1,
              textAlign: 'right',
              color: 'var(--gold)', fontWeight: 650,
              background: 'rgba(176, 138, 62, 0.06)',
              minWidth: 0,
              lineHeight: 1.35,
            }}>{row.vip}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
