import { useState, useEffect, useCallback } from 'react'
import {
  Container, Box, Typography, Button, CircularProgress, Paper, Chip, Stack, IconButton, Tooltip,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined'
import './styles/index.css'
import LoginForm from './components/LoginForm'
import Billing from './components/Billing'
import Profile from './components/Profile'
import History from './components/History'
import { fetchMe, fetchMembership, logout } from './utils/api'

const fmtDate = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// asg100 = 安全隐患域会员中心。视图：login → home（会员主页）→ billing / profile
function App() {
  const [me, setMe] = useState(null)
  const [meReady, setMeReady] = useState(false)
  const [membership, setMembership] = useState(null)
  const [view, setView] = useState('home')

  const refreshMembership = useCallback(() => {
    fetchMembership().then(setMembership).catch(() => setMembership(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((data) => {
        if (cancelled) return
        setMe(data)
        if (data) refreshMembership()
      })
      .catch(() => { if (!cancelled) setMe(null) })
      .finally(() => { if (!cancelled) setMeReady(true) })
    return () => { cancelled = true }
  }, [refreshMembership])

  const handleLoggedIn = (data) => {
    setMe(data)
    setView('home')
    refreshMembership()
  }

  const handleLogout = async () => {
    try { await logout() } catch { /* ignore */ }
    setMe(null)
    setMembership(null)
    setView('home')
  }

  const handlePaid = () => {
    refreshMembership()
    setView('profile')
  }

  if (!meReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f6f9' }}>
        <CircularProgress size={32} sx={{ color: '#1e3a5f' }} />
      </Box>
    )
  }

  // 未登录
  if (!me) {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          py: { xs: 5, md: 8 },
          px: 2,
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(30,58,95,0.07) 0%, rgba(244,246,249,0) 55%), #f4f6f9',
        }}
      >
        <Container maxWidth="xs" disableGutters sx={{ px: 0 }}>
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                mx: 'auto',
                mb: 2,
                borderRadius: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, #244a72 0%, #1e3a5f 100%)',
                boxShadow: '0 6px 16px rgba(30,58,95,0.25)',
              }}
            >
              <GppGoodOutlinedIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
            <Typography
              sx={{
                fontSize: { xs: '1.5rem', md: '1.7rem' },
                fontWeight: 800,
                color: '#1e3a5f',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                mb: 1,
              }}
            >
              安全隐患识别
              <Box component="span" sx={{ color: '#94a3b8', fontWeight: 600, mx: 0.75 }}>·</Box>
              会员中心
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.7, maxWidth: 320, mx: 'auto', textWrap: 'balance' }}>
              登录后开通 VIP，解锁台账下载、历史记录与全部安防文档
            </Typography>
          </Box>
          <LoginForm onLoggedIn={handleLoggedIn} />
        </Container>
      </Box>
    )
  }

  const isVip = membership?.isVip

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 2, md: 4 }, backgroundColor: '#f4f6f9' }}>
      <Container maxWidth="sm">
        {/* 顶部：手机号 + 退出 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>{me.phone}</Typography>
          <Tooltip title="退出登录">
            <IconButton size="small" onClick={handleLogout} sx={{ color: '#94a3b8', p: 0.5 }}>
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" color="primary.main" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
            会员中心
            <Chip label="安全隐患域" size="small" sx={{ ml: 1, bgcolor: 'primary.main', color: '#fff', height: 20, fontSize: '0.7rem', verticalAlign: 'middle' }} />
          </Typography>
        </Box>

        <Paper className="glass-card fade-in-up" sx={{ p: { xs: 2, md: 3 } }}>
          {view === 'home' && (
            <Box>
              {/* VIP 状态条 */}
              <Box
                sx={{
                  p: 2, mb: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: isVip ? 'linear-gradient(135deg,#1e3a5f,#2c5282)' : '#f1f5f9',
                  color: isVip ? '#fff' : '#64748b',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WorkspacePremiumIcon sx={{ color: isVip ? '#f59e0b' : '#cbd5e1' }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{isVip ? 'VIP 会员' : '普通用户'}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      {isVip ? `有效期至 ${fmtDate(membership.vipExpireAt)}` : '尚未开通 VIP'}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained" size="small" onClick={() => setView('billing')}
                  sx={{ bgcolor: isVip ? 'rgba(255,255,255,0.2)' : '#1e3a5f', '&:hover': { bgcolor: isVip ? 'rgba(255,255,255,0.3)' : '#2c5282' } }}
                >
                  {isVip ? '续费' : '开通'}
                </Button>
              </Box>

              {/* 入口 */}
              <Stack spacing={1.5}>
                <Button variant="outlined" fullWidth onClick={() => setView('history')} sx={{ py: 1.4, justifyContent: 'flex-start', color: '#1e3a5f', borderColor: '#cbd5e1' }}>
                  我的识别历史
                </Button>
                <Button variant="outlined" fullWidth onClick={() => setView('profile')} sx={{ py: 1.4, justifyContent: 'flex-start', color: '#1e3a5f', borderColor: '#cbd5e1' }}>
                  个人中心 · 购买记录
                </Button>
                <Button variant="outlined" fullWidth onClick={() => setView('billing')} sx={{ py: 1.4, justifyContent: 'flex-start', color: '#1e3a5f', borderColor: '#cbd5e1' }}>
                  开通 / 续费 VIP
                </Button>
              </Stack>

              <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#94a3b8', textAlign: 'center' }}>
                隐患识别、安防文档库等功能登录后即可在各产品内使用，VIP 状态全域通用
              </Typography>
            </Box>
          )}

          {view === 'billing' && <Billing onPaid={handlePaid} onBack={() => setView('home')} />}
          {view === 'profile' && <Profile membership={membership} onBuy={() => setView('billing')} onBack={() => setView('home')} />}
          {view === 'history' && <History onBack={() => setView('home')} />}
        </Paper>
      </Container>

      <Box sx={{ textAlign: 'center', mt: 4, py: 2, color: 'text.secondary' }}>
        <Typography variant="caption" sx={{ display: 'block' }}>谨世ASG人工智能实验室出品</Typography>
      </Box>
    </Box>
  )
}

export default App
