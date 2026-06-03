import React, { useState, useEffect } from 'react';
import { Box, Stack, CircularProgress, IconButton, Button, Snackbar, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { fetchHistory, fetchHazardDetail, checkLedger, triggerLedgerDownload } from '../utils/api';

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

// 整改建议：按行拆分、去掉行首序号
const parseFix = (t) => String(t || '').split('\n').map((s) => s.replace(/^\d+[\.\、\s]*/, '').trim()).filter(Boolean);
// 预算末尾的"元"去掉（与 A600 一致）
const stripYuan = (t) => String(t || '').replace(/\s*元\s*$/, '').trim();

// 字段小标题：accent 下划线（对齐 A600 详情的分节标题）
function FieldLabel({ children }) {
  return (
    <Box sx={{
      display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink)',
      mb: 0.6, pb: 0.25, borderBottom: '2px solid var(--accent)',
    }}>
      {children}
    </Box>
  );
}

/**
 * 我的历史：聚合各业务积木的记录（当前只有 A600 识别）。
 * 列表 → 点开看详情（照片 + 完整隐患清单，与 A600 当时显示一致）。
 * 列表头右上「下载台账」→ 下载最近 3 天 Excel（含现场照片，VIP 专享）。
 */
export default function History({ onBack, onBuy, isVip }) {
  const [items, setItems] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info', withBuy: false });
  // 挂载时预检台账：用户点击时纯同步跳转，避免 await 之后丢失用户手势被微信/iOS 拦截。
  // null = 未检 / { ok: true, count } / { ok: false, reason: 'forbidden'|'empty'|'error' }
  const [ledgerCheck, setLedgerCheck] = useState(null);

  useEffect(() => {
    fetchHistory()
      .then((d) => { setItems(d.items); })
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!isVip) return;
    checkLedger(3).then(setLedgerCheck);
  }, [isVip]);

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

  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  // 同步函数：不能有 await，否则 window.location.href 会在微信/iOS 失去用户手势被拦截。
  // 预检结果（含签名 URL）已在挂载时拿到，这里只做分发 + 同步跳转。
  // 签名 URL 跨进程友好：用户用「在浏览器中打开」跳到外部浏览器也能下载，不必重登。
  const handleDownload = () => {
    if (!isVip) {
      setSnack({ open: true, msg: '开通 VIP 后可下载台账', severity: 'warning', withBuy: true });
      return;
    }
    if (downloading) return;
    if (ledgerCheck === null) {
      setSnack({ open: true, msg: '正在准备，请稍后再试', severity: 'info', withBuy: false });
      return;
    }
    if (!ledgerCheck.ok) {
      if (ledgerCheck.reason === 'forbidden') {
        setSnack({ open: true, msg: '开通 VIP 后可下载台账', severity: 'warning', withBuy: true });
      } else if (ledgerCheck.reason === 'empty') {
        setSnack({ open: true, msg: '最近 3 天没有识别记录', severity: 'info', withBuy: false });
      } else {
        setSnack({ open: true, msg: '下载暂不可用，请稍后重试', severity: 'error', withBuy: false });
      }
      return;
    }
    if (!ledgerCheck.downloadUrl) {
      setSnack({ open: true, msg: '下载链接未就绪，请稍后重试', severity: 'error', withBuy: false });
      return;
    }
    setDownloading(true);
    triggerLedgerDownload(ledgerCheck.downloadUrl);
    setSnack({ open: true, msg: '台账已开始下载（最近 3 天）', severity: 'success', withBuy: false });
    setTimeout(() => setDownloading(false), 1500);
  };

  // ─── 详情视图：照片 + 每条隐患的完整字段（与 A600 当时显示一致）───
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
        <Box sx={{ pl: 4.5, mb: 2 }}>
          <Box sx={{ fontSize: '0.88rem', color: 'var(--ink-2)', mb: 0.5 }}>
            {detail.scenarioLabel} <Box component="span" className="num" sx={{ color: 'var(--ink-3)', ml: 0.5 }}>· {fmtTime(detail.createdAt)}</Box>
          </Box>
          <Box sx={{ fontSize: '0.88rem', color: 'var(--ink)' }}>
            共发现 <Box component="span" className="num" sx={{ fontWeight: 700, color: 'var(--ink)' }}>{detail.hazardCount}</Box> 个隐患
          </Box>
        </Box>

        {/* 现场照片（老记录可能没存 → 不显示，不编造） */}
        {detail.image && (
          <Box sx={{ mb: 2 }}>
            <Box
              component="img"
              src={detail.image}
              alt="现场照片"
              sx={{
                width: '100%', maxHeight: 320, objectFit: 'contain',
                borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
                background: 'var(--bg-mute)', display: 'block',
              }}
            />
          </Box>
        )}

        <Stack spacing={1.25}>
          {detail.hazards.map((h, i) => {
            const tk = tokenFor(h.hazard_level);
            const fixList = parseFix(h.rectification_suggestions);
            return (
              <Box key={i} sx={{
                p: 2,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                borderLeft: `3px solid ${tk.color}`,
              }}>
                {/* 标题：序号 + 名称 + 等级 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 1.25 }}>
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

                {/* 具体描述 */}
                {h.hazard_description && (
                  <Box sx={{ mb: 1.25 }}>
                    <FieldLabel>具体描述</FieldLabel>
                    <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.65, textWrap: 'pretty' }}>
                      {h.hazard_description}
                    </Box>
                  </Box>
                )}

                {/* 涉及规范 */}
                {h.relevant_regulations && (
                  <Box sx={{ mb: 1.25 }}>
                    <FieldLabel>涉及规范</FieldLabel>
                    <Box className="num" sx={{ fontSize: '0.78rem', color: 'var(--ink-2)', lineHeight: 1.6, wordBreak: 'break-all' }}>
                      {h.relevant_regulations}
                    </Box>
                  </Box>
                )}

                {/* 整改建议 */}
                {fixList.length > 0 && (
                  <Box sx={{ mb: 1.25 }}>
                    <FieldLabel>整改建议</FieldLabel>
                    <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                      {fixList.map((s, j) => (
                        <Box component="li" key={j} sx={{
                          display: 'flex', gap: 1,
                          mb: j === fixList.length - 1 ? 0 : 0.6,
                          fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.55,
                        }}>
                          <Box className="num" sx={{ flexShrink: 0, color: tk.color, fontWeight: 700, fontSize: '0.75rem', pt: '2px', minWidth: 18 }}>
                            {String(j + 1).padStart(2, '0')}
                          </Box>
                          <Box sx={{ flex: 1 }}>{s}</Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* 预算经费 */}
                {h.estimated_budget && (
                  <Box>
                    <FieldLabel>预算经费</FieldLabel>
                    <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                      {stripYuan(h.estimated_budget)}
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>

        <Snackbar open={snack.open} autoHideDuration={4000} onClose={closeSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snack.severity} variant="filled" onClose={closeSnack} sx={{ borderRadius: 'var(--r-sm)' }}>
            {snack.msg}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // ─── 列表视图 ───
  const hasItems = items && items.length > 0;
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
        {hasItems && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box className="num" sx={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>
              {items.length} 条
            </Box>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              startIcon={
                downloading
                  ? <CircularProgress size={14} sx={{ color: 'inherit' }} />
                  : (isVip ? <DownloadIcon sx={{ fontSize: 16 }} /> : <LockOutlinedIcon sx={{ fontSize: 15 }} />)
              }
              disableElevation
              sx={{
                px: 1.5, py: 0.5, minWidth: 0,
                fontSize: '0.78rem', fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em',
                borderRadius: 'var(--r-sm)', color: '#fff', background: 'var(--accent)',
                transition: 'transform .12s ease, background .2s ease',
                '&:hover': { background: 'var(--accent-2)' },
                '&:active': { transform: 'scale(0.97)' },
                '&.Mui-disabled': { background: 'var(--ink-4)', color: '#fff' },
              }}
            >
              下载台账{isVip ? '' : ' · VIP'}
            </Button>
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

      {detailLoading && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={18} sx={{ color: 'var(--accent)' }} />
        </Box>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={closeSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={closeSnack}
          sx={{ borderRadius: 'var(--r-sm)' }}
          action={snack.withBuy ? (
            <Button color="inherit" size="small" onClick={() => { closeSnack(); onBuy?.(); }}>
              去开通
            </Button>
          ) : undefined}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
