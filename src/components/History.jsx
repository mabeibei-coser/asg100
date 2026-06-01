import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Button, Chip, Divider, Stack, CircularProgress, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import { fetchHistory, fetchHazardDetail } from '../utils/api';

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const LEVEL_COLOR = { 高: '#dc2626', 中: '#d97706', 低: '#059669' };

/**
 * 我的历史：聚合各业务积木的记录（当前只有 A600 识别）。
 * 列表 → 点开看详情（隐患清单）。数据来自中心只读聚合，只含本人记录。
 */
export default function History({ onBack }) {
  const [items, setItems] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchHistory()
      .then((d) => { setItems(d.items); setDownloads(d.downloads || []); })
      .catch(() => setItems([]));
  }, []);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      setDetail(await fetchHazardDetail(id));
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── 详情视图 ──
  if (detail) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton size="small" onClick={() => setDetail(null)}><ArrowBackIcon /></IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a5f' }}>识别详情</Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
          {detail.scenarioLabel} · {fmtTime(detail.createdAt)}
        </Typography>
        <Typography variant="body2" sx={{ color: '#334155', mb: 2 }}>
          共发现 <b>{detail.hazardCount}</b> 个隐患
        </Typography>
        <Stack spacing={1.5}>
          {detail.hazards.map((h, i) => (
            <Card key={i} sx={{ p: 1.75, borderLeft: `3px solid ${LEVEL_COLOR[h.hazard_level] || '#d97706'}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                  {i + 1}. {h.hazard_name}
                </Typography>
                <Chip label={`${h.hazard_level}风险`} size="small"
                  sx={{ height: 20, fontSize: '0.65rem', bgcolor: LEVEL_COLOR[h.hazard_level] || '#d97706', color: '#fff' }} />
              </Box>
              <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.6 }}>
                {h.hazard_description}
              </Typography>
            </Card>
          ))}
        </Stack>
        <Button fullWidth onClick={() => setDetail(null)} sx={{ mt: 2, color: '#94a3b8' }}>返回列表</Button>
      </Box>
    );
  }

  // ── 列表视图 ──
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a5f', textAlign: 'center', mb: 2 }}>
        我的识别历史
      </Typography>

      {items === null ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : items.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <ImageSearchIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            暂无识别记录，去隐患识别上传照片开始检测
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1}>
          {items.map((it) => (
            <Card key={`${it.source}-${it.id}`}
              onClick={() => openDetail(it.id)}
              sx={{ p: 1.75, cursor: 'pointer', '&:hover': { boxShadow: '0 2px 8px rgba(30,58,95,0.12)' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontWeight: 600, color: '#1e3a5f', fontSize: '0.95rem' }}>
                    {it.scenarioLabel}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>{fmtTime(it.createdAt)}</Typography>
                </Box>
                <Chip label={`${it.hazardCount} 个隐患`} size="small"
                  sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }} />
              </Box>
            </Card>
          ))}
        </Stack>
      )}

      {/* 文档下载记录 */}
      {downloads.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontWeight: 600, color: '#1e3a5f', mb: 1 }}>文档下载记录</Typography>
          <Divider sx={{ mb: 1 }} />
          <Stack spacing={1}>
            {downloads.map((d) => (
              <Box key={`doc-${d.id}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.85rem' }}>{d.title}</Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>{fmtTime(d.createdAt)}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {detailLoading && (
        <Box sx={{ textAlign: 'center', py: 1 }}><CircularProgress size={18} /></Box>
      )}
      <Button fullWidth onClick={onBack} sx={{ mt: 2, color: '#94a3b8' }}>返回</Button>
    </Box>
  );
}
