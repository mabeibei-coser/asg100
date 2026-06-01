import React, { useState, useEffect } from 'react';
import { Box, Stack, CircularProgress, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fetchHistory, fetchHazardDetail } from '../utils/api';

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 风险等级对应 token：高=danger / 中=gold / 低=accent
const LEVEL_TOKEN = {
  高: { color: 'var(--danger)',  soft: 'var(--danger-soft)',  ink: '#7a2b1a', label: '高风险' },
  中: { color: 'var(--gold)',    soft: 'var(--gold-soft)',    ink: '#7a5d22', label: '中风险' },
  低: { color: 'var(--accent)',  soft: 'var(--accent-soft)',  ink: 'var(--accent-ink)', label: '低风险' },
};
const tokenFor = (lv) => LEVEL_TOKEN[lv] || LEVEL_TOKEN['中'];

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

  // ─── 详情视图 ───
  if (detail) {
    return (
      <Box sx={{ maxWidth: 540, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton size="small" onClick={() => setDetail(null)} sx={{
            color: 'var(--ink-3)', mr: 0.5,
            '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
          }}>
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <h2 className="h-section" style={{ fontSize: '1.15rem' }}>识别详情</h2>
        </Box>
        <Box sx={{ pl: 4.5, mb: 2.5 }}>
          <Box sx={{ fontSize: '0.88rem', color: 'var(--ink-2)', mb: 0.5 }}>
            {detail.scenarioLabel} <Box component="span" className="num" sx={{ color: 'var(--ink-3)', ml: 0.5 }}>· {fmtTime(detail.createdAt)}</Box>
          </Box>
          <Box sx={{ fontSize: '0.88rem', color: 'var(--ink)' }}>
            共发现 <Box component="span" className="num" sx={{ fontWeight: 700, color: 'var(--ink)' }}>{detail.hazardCount}</Box> 个隐患
          </Box>
        </Box>
        <Stack spacing={1.25}>
          {detail.hazards.map((h, i) => {
            const tk = tokenFor(h.hazard_level);
            return (
              <Box key={i} sx={{
                p: 2,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                borderLeft: `3px solid ${tk.color}`,
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 0.75 }}>
                  <Box sx={{ fontSize: '0.95rem', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.4, letterSpacing: '-0.005em' }}>
                    <Box component="span" className="num" sx={{ color: 'var(--ink-3)', mr: 0.6, fontWeight: 500 }}>{i + 1}.</Box>
                    {h.hazard_name}
                  </Box>
                  <Box sx={{
                    flexShrink: 0,
                    px: 0.85, py: 0.2,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    borderRadius: 'var(--r-xs)',
                    background: tk.soft,
                    color: tk.ink,
                    border: `1px solid ${tk.color}`,
                  }}>
                    {tk.label}
                  </Box>
                </Box>
                <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.65 }}>
                  {h.hazard_description}
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Box>
    );
  }

  // ─── 列表视图 ───
  return (
    <Box sx={{ maxWidth: 540, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton size="small" onClick={onBack} sx={{
          color: 'var(--ink-3)', mr: 0.5,
          '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
        }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <h2 className="h-section" style={{ fontSize: '1.15rem' }}>我的识别历史</h2>
        {items && items.length > 0 && (
          <Box className="num" sx={{ ml: 'auto', fontSize: '0.78rem', color: 'var(--ink-3)' }}>
            {items.length} 条
          </Box>
        )}
      </Box>

      {items === null ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <CircularProgress size={22} sx={{ color: 'var(--accent)' }} />
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{
          py: 5, textAlign: 'center',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-mute)',
        }}>
          <ImageSearchIcon sx={{ fontSize: 38, color: 'var(--ink-4)', mb: 1.25 }} />
          <Box sx={{ color: 'var(--ink-2)', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: 280, mx: 'auto' }}>
            暂无识别记录
            <Box sx={{ color: 'var(--ink-3)', fontSize: '0.78rem', mt: 0.5 }}>
              去隐患识别上传照片开始检测
            </Box>
          </Box>
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map((it) => (
            <Box
              key={`${it.source}-${it.id}`}
              onClick={() => openDetail(it.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(it.id); } }}
              sx={{
                p: 1.75,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                transition: 'all .18s cubic-bezier(0.2, 0.7, 0.2, 1)',
                '&:hover': {
                  borderColor: 'rgba(15, 118, 110, 0.32)',
                  background: '#fff',
                  boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)',
                  transform: 'translateX(2px)',
                  '& .chevron': { transform: 'translateX(2px)', color: 'var(--accent)' },
                },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                  {it.scenarioLabel}
                </Box>
                <Box className="num" sx={{ fontSize: '0.74rem', color: 'var(--ink-3)', mt: 0.35 }}>
                  {fmtTime(it.createdAt)}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                <Box sx={{
                  px: 0.9, py: 0.25,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  borderRadius: 'var(--r-xs)',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-ink)',
                }}>
                  <Box component="span" className="num">{it.hazardCount}</Box> 个隐患
                </Box>
                <ChevronRightIcon className="chevron" sx={{
                  fontSize: 18,
                  color: 'var(--ink-4)',
                  transition: 'transform .2s ease, color .2s ease',
                }} />
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {/* 文档下载记录 */}
      {downloads.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <h3 className="h-section" style={{ fontSize: '0.95rem', marginBottom: 12 }}>文档下载记录</h3>
          <Stack divider={<Box sx={{ height: '1px', background: 'var(--line)' }} />}>
            {downloads.map((d) => (
              <Box key={`doc-${d.id}`} sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1.25,
                px: 0.25,
              }}>
                <Box sx={{ fontSize: '0.86rem', color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 1.5 }}>
                  {d.title}
                </Box>
                <Box className="num" sx={{ fontSize: '0.74rem', color: 'var(--ink-3)', flexShrink: 0 }}>
                  {fmtTime(d.createdAt)}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {detailLoading && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={18} sx={{ color: 'var(--accent)' }} />
        </Box>
      )}
    </Box>
  );
}
