import { useState, useEffect, useCallback } from 'react'
import {
  Container, Box, Button, CircularProgress, IconButton, Tooltip,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined'
import HistoryIcon from '@mui/icons-material/History'
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import './styles/index.css'
import homeHeroDesktop from './assets/home-ref-hero-desktop.jpg'
import homeHeroMobile from './assets/home-ref-hero-mobile.jpg'
import homeIdentifyArt from './assets/home-ref-identify.png'
import homeDocsArt from './assets/home-ref-docs.png'
import LoginForm from './components/LoginForm'
import LegalView from './components/LegalView'
import Billing from './components/Billing'
import Profile from './components/Profile'
import History from './components/History'
import Payments from './components/Payments'
import { fetchMe, fetchMembership, logout } from './utils/api'

const fmtDate = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const daysLeft = (ts) => {
  if (!ts) return 0
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000))
}

// 手机号中间 6 位打码：18621933756 → 186******56
const maskPhone = (p) => (p ? String(p).replace(/(\d{3})\d{6}(\d{2})/, '$1******$2') : p)

// 数据更新标签：始终显示当前真实年月（如「2026年6月」），随系统时间自动走
const currentMonthLabel = () => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

// 文档库 A800 一库管两域（安防ASG/人才ATA），跳过去必须带 ?category= 让前台展示对应域文档；
// 不带也行（后端按 cookie 兜底），但显式传更稳，避免双 cookie 场景被识别错。
const DOC_LIB_ASG_URL = '/a800/?category=' + encodeURIComponent('安防ASG')

// asg100 = 安全隐患域会员中心。设计语言 v2：墨黑 + 深青绿 + 暖白纸感
function App() {
  const [me, setMe] = useState(null)
  const [meReady, setMeReady] = useState(false)
  const [membership, setMembership] = useState(null)
  // 平台首页对所有人可见、不强制登录；点功能按钮时才校验。
  // 受保护视图（billing/profile/history）未登录会落到登录界面，登录后就地展开。
  // OAuth 回跳会落到 /asg100/billing：登录态已在，直接展开开通页，付款一气呵成。
  // 跨产品（如 A600 底部导航）跳过来时带 ?view=history|profile|billing，直接展开对应页。
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'home'
    if (window.location.pathname.replace(/\/+$/, '').endsWith('/billing')) return 'billing'
    const q = new URLSearchParams(window.location.search).get('view')
    if (q && ['history', 'profile', 'billing', 'payments'].includes(q)) return q
    return 'home'
  })
  // 跨产品按钮（隐患识别 /a600/、文档库 /a800/）未登录时记下目标，登录后再跳
  const [pendingNav, setPendingNav] = useState(null)

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
    refreshMembership()
    // 登录后回到用户原本想去的地方
    if (pendingNav) { const url = pendingNav; setPendingNav(null); window.location.href = url; return }
    // 主动点"登录"进来的回首页；进受保护视图（billing/profile/history）的就地展开，不动 view
    if (view === 'login') setView('home')
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

  // 跳转到同域其它产品：已登录直接去；未登录先登录，登录后再去
  const goProduct = (url) => {
    if (me) { window.location.href = url }
    else { setPendingNav(url); setView('login') }
  }

  if (!meReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: 'var(--accent)' }} />
      </Box>
    )
  }

  const GATED_VIEWS = ['billing', 'profile', 'history', 'payments']
  // 登录界面：主动点"登录"(view==='login')，或未登录却进了受保护视图 → 拦在这里登录
  const showLogin = view === 'login' || (GATED_VIEWS.includes(view) && !me)

  // 登录界面：顶对齐 + 纸感背景，与首页同款品牌底；左上角可返回首页
  if (showLogin) {
    return (
      <Box className="login-page asg-subpage-bg" sx={{
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column',
        pt: { xs: '6vh', md: '8vh' }, pb: { xs: 4, md: 6 }, px: 2,
      }}>
        <Container maxWidth="xs" disableGutters sx={{ px: 0 }}>
          <Box sx={{ mb: 0.5 }}>
            <IconButton size="small" onClick={() => { setPendingNav(null); setView('home') }} sx={{
              color: 'var(--ink-3)',
              '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
            }}>
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              width: 46, height: 46, mx: 'auto', mb: 1.75,
              borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(180deg, #134e4a 0%, #0f766e 100%)',
              boxShadow: '0 8px 22px rgba(15, 118, 110, 0.28)',
            }}>
              <ShieldOutlinedIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <div className="h-eyebrow" style={{ marginBottom: 8 }}>asg100 · 会员中心</div>
            <h1 className="h-display" style={{ fontSize: '1.42rem', lineHeight: 1.2, marginBottom: 10 }}>
              欢迎使用安全隐患识别平台
            </h1>
            <p style={{ color: 'var(--ink-2)', fontSize: '0.86rem', lineHeight: 1.5, margin: '0 auto' }}>
              全场景识别 · 智能分析
            </p>
            {/* 数据新鲜度药丸：呼吸绿点 + 当前年月，传达「持续更新」的可信感 */}
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.7,
              mt: 1.6, px: 1.3, py: 0.5, borderRadius: 999,
              background: 'var(--accent-soft)', border: '1px solid rgba(15,118,110,0.18)',
              color: 'var(--accent-ink)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.01em',
            }}>
              <Box aria-hidden className="pulse-dot" sx={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
              }} />
              数据更新至 {currentMonthLabel()}
            </Box>
          </Box>
          <LoginForm onLoggedIn={handleLoggedIn} />
        </Container>
      </Box>
    )
  }

  const isVip = membership?.isVip
  const left = isVip ? daysLeft(membership.vipExpireAt) : 0

  if (view === 'home') {
    return (
      <HomeLanding
        onGoIdentify={() => goProduct('/a600/')}
        onGoResources={() => goProduct(DOC_LIB_ASG_URL)}
        onGoHistory={() => setView('history')}
        onGoProfile={() => setView('profile')}
      />
    )
  }

  return (
    <Box className="app-page asg-subpage-bg" sx={{ minHeight: '100vh', py: { xs: 2, md: 0 }, pb: { xs: 11, md: 0 } }}>
      <Container className="app-container" maxWidth="lg">
        {/* ═══ 顶部 nav：左 logo + 标题；右 手机号 + 退出 ═══ */}
        <Box component="nav" className="app-topbar rise" sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          mb: { xs: 2.5, md: 4 },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box className="app-brand-icon" sx={{
              width: 32, height: 32, borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(180deg, #134e4a 0%, #0f766e 100%)',
              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)',
              flexShrink: 0,
            }}>
              <ShieldOutlinedIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box className="app-brand-title" sx={{ fontSize: '0.95rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.012em', lineHeight: 1.2 }}>
              安全隐患域 · 会员中心
            </Box>
          </Box>
          {me?.phone && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', fontWeight: 500 }}>
                {maskPhone(me.phone)}
              </Box>
              <IconButton size="small" onClick={handleLogout} sx={{ color: 'var(--ink-3)', p: 0.5 }}>
                <LogoutIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}
        </Box>

        {view === 'home' && (
          <>
            {/* ═══ 欢迎区：左对齐，破对称 ═══ */}
            <Box className="rise rise-1" component="header" sx={{ mb: { xs: 4, md: 5 } }}>
              <div className="h-eyebrow" style={{ marginBottom: 10 }}>welcome back</div>
              <h1 className="h-display" style={{ marginBottom: 12 }}>
                识别风险 · 查阅安防档
              </h1>
              <p style={{ color: 'var(--ink-2)', fontSize: '0.95rem', lineHeight: 1.65, maxWidth: 560 }}>
                登录态在 asg100 全域通用，点击下方功能直接进入对应产品，无需重登。
              </p>
            </Box>

            {/* ═══ 主角：两张功能卡 ═══ */}
            <Box className="rise rise-2" component="section" sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: { xs: 2, md: 3 },
              mb: { xs: 3, md: 4 },
            }}>
              <FeatureCard
                icon={<ShieldOutlinedIcon sx={{ fontSize: 26 }} />}
                eyebrow="A600"
                title="隐患识别"
                desc="上传施工现场图片或文字描述，AI 帮你识别隐患点，自动生成台账可下载。"
                href="/a600/"
                onActivate={() => goProduct('/a600/')}
              />
              <FeatureCard
                icon={<LibraryBooksOutlinedIcon sx={{ fontSize: 26 }} />}
                eyebrow="A800"
                title="安防文档库"
                desc="标准 / 制度 / 方案 / 模板，按主题与场景检索。VIP 可下载全部档案。"
                href={DOC_LIB_ASG_URL}
                onActivate={() => goProduct(DOC_LIB_ASG_URL)}
              />
            </Box>

            {/* ═══ VIP 横条（次要）═══ */}
            <Box className="rise rise-3" component="section" sx={{
              p: { xs: 2, md: 2.25 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mb: { xs: 4, md: 5 },
              borderRadius: 'var(--r-lg)',
              border: '1px solid',
              borderColor: isVip ? 'rgba(176, 138, 62, 0.28)' : 'var(--line)',
              background: isVip
                ? 'linear-gradient(135deg, #fdf6e4 0%, #f7ecca 100%)'
                : 'var(--bg-elev)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, minWidth: 0 }}>
                <Box sx={{
                  width: 38, height: 38, borderRadius: 'var(--r-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isVip ? 'rgba(176, 138, 62, 0.18)' : 'var(--bg-mute)',
                  color: isVip ? 'var(--gold)' : 'var(--ink-3)',
                  flexShrink: 0,
                }}>
                  <WorkspacePremiumIcon sx={{ fontSize: 21 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>
                    {isVip ? 'VIP 会员' : '普通用户'}
                  </Box>
                  <Box sx={{ fontSize: '0.8rem', color: 'var(--ink-2)', mt: 0.4, lineHeight: 1.45 }}>
                    {isVip ? (
                      <>剩余 <span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{left}</span> 天 · 到期 <span className="num">{fmtDate(membership.vipExpireAt)}</span></>
                    ) : (
                      '尚未开通 · 升级后可下载台账与全部安防文档'
                    )}
                  </Box>
                </Box>
              </Box>
              <Button
                onClick={() => setView('billing')}
                disableElevation
                sx={{
                  px: 2.25, py: 0.95,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: 'var(--r-sm)',
                  color: '#fff',
                  background: 'var(--ink)',
                  flexShrink: 0,
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                  transition: 'transform .12s ease, background .2s ease, box-shadow .2s ease',
                  '&:hover': { background: '#000', boxShadow: '0 4px 12px rgba(15, 20, 25, 0.18)' },
                  '&:active': { transform: 'scale(0.97)' },
                }}
              >
                {isVip ? '续费' : '开通 VIP'}
              </Button>
            </Box>

            {/* ═══ 管理项：文字链组 ═══ */}
            <Box className="rise rise-4" component="nav" sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: { xs: 1.5, md: 2.5 },
              alignItems: 'center',
              justifyContent: 'center',
              mb: 5,
            }}>
              <TextLink onClick={() => setView('history')} icon={<HistoryIcon sx={{ fontSize: 14 }} />}>
                我的识别历史
              </TextLink>
              <Dot />
              <TextLink onClick={() => setView('profile')}>个人中心 · 购买记录</TextLink>
            </Box>
          </>
        )}

        {view !== 'home' && (
          <Box className={`surface app-surface rise${['billing', 'profile', 'history'].includes(view) ? ' app-surface-no-mark' : ''}`} component="section" sx={{ p: { xs: 2.5, md: 3.5 } }}>
            {view === 'billing' && <Billing onPaid={handlePaid} onBack={() => setView('home')} />}
            {view === 'profile' && <Profile membership={membership} onBuy={() => setView('billing')} onBack={() => setView('home')} onGoHistory={() => setView('history')} onGoPayments={() => setView('payments')} />}
            {view === 'history' && <History onBack={() => setView('home')} onBuy={() => setView('billing')} isVip={isVip} />}
            {view === 'payments' && <Payments onBack={() => setView('profile')} />}
          </Box>
        )}

        {view !== 'profile' && (
          <Box className="app-footer" component="footer" sx={{ textAlign: 'center', mt: 5, pb: 3 }}>
            <Box sx={{ fontSize: '0.72rem', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
              谨世 ASG 人工智能实验室 出品
            </Box>
          </Box>
        )}
      </Container>
      <BottomNav
        active={view === 'history' ? 'records' : view === 'home' ? 'home' : 'mine'}
        onGoHome={() => setView('home')}
        onGoHistory={() => setView('history')}
        onGoProfile={() => setView('profile')}
      />
    </Box>
  )
}

function HomeLanding({ onGoIdentify, onGoResources, onGoHistory, onGoProfile }) {
  const currentYear = new Date().getFullYear()

  return (
    <Box className="home-page home-redesign-page">
      <header className="home-desktop-header">
        <div className="home-brand-block" aria-label="ASG安全隐患识别5.0">
          <span className="home-brand-mark">
            <ShieldOutlinedIcon />
            <span>ASG</span>
          </span>
        </div>
        <div className="home-header-version">
          大数据库版本：<span>{currentMonthLabel()}</span>
        </div>
        <nav className="home-desktop-nav" aria-label="桌面导航">
          <button className="is-active" type="button">
            <HomeRoundedIcon />
            <span>首页</span>
          </button>
          <button type="button" onClick={onGoHistory}>
            <HistoryIcon />
            <span>记录</span>
          </button>
          <button type="button" onClick={onGoProfile}>
            <PersonOutlineOutlinedIcon />
            <span>我的</span>
          </button>
        </nav>
      </header>

      <main className="home-redesign-main">
        <section className="home-hero-copy" aria-labelledby="home-main-title">
          <div className="home-mobile-version">大数据库版本<span>{currentMonthLabel()}</span></div>
          <h1 id="home-main-title">
            <span className="home-title-text">安全隐患识别5.0</span>
            <span className="home-title-badge">专业版</span>
          </h1>
          <div className="home-title-line" aria-hidden="true" />
          <p>
            <span className="home-copy-desktop">汇聚全域安全数据 · 智能识别风险隐患 · 辅助安全管理</span>
            <span className="home-copy-mobile">汇聚全域安全数据 · 智能识别风险隐患 · 赋能安全决策<br />守护生命安全 · 共建平安中国</span>
          </p>
        </section>

        <section className="home-hero-art" aria-label="安全数据主视觉">
          <picture>
            <source media="(max-width: 767px)" srcSet={homeHeroMobile} />
            <img src={homeHeroDesktop} alt="" />
          </picture>
        </section>

        <section className="home-entry-list" aria-label="主要功能入口">
          <HomeEntryCard
            image={homeIdentifyArt}
            title="隐患识别"
            desc="图像识别 · 智能分析 · 风险定位"
            onClick={onGoIdentify}
          />
          <HomeEntryCard
            image={homeDocsArt}
            title="资料大全"
            desc="法规标准 · 案例库 · 知识图谱"
            onClick={onGoResources}
          />
        </section>
      </main>

      <footer className="home-legal-footer">
        ASG大数据中心2013-{currentYear} · 沪ICP备2023040758号-1
      </footer>

      <div className="home-mobile-nav">
        <BottomNav active="home" onGoHome={() => {}} onGoHistory={onGoHistory} onGoProfile={onGoProfile} />
      </div>
    </Box>
  )
}

function HomeEntryCard({ image, title, desc, onClick }) {
  return (
    <button className="home-entry-card" type="button" onClick={onClick}>
      <span className="home-entry-image">
        <img src={image} alt="" />
      </span>
      <span className="home-entry-copy">
        <strong>{title}</strong>
        <span>{desc}</span>
      </span>
      <span className="home-entry-arrow" aria-hidden="true">
        <ChevronRightIcon />
      </span>
    </button>
  )
}

function BottomNav({ active, onGoHome, onGoHistory, onGoProfile }) {
  return (
    <nav className="home-bottom-nav" aria-label="底部导航">
      <button
        className={`home-nav-item${active === 'home' ? ' is-active' : ''}`}
        type="button"
        onClick={onGoHome}
      >
        <HomeRoundedIcon />
        <span>首页</span>
      </button>
      <button
        className={`home-nav-item${active === 'records' ? ' is-active' : ''}`}
        type="button"
        onClick={onGoHistory}
      >
        <HistoryIcon />
        <span>记录</span>
      </button>
      <button
        className={`home-nav-item${active === 'mine' ? ' is-active' : ''}`}
        type="button"
        onClick={onGoProfile}
      >
        <PersonOutlineOutlinedIcon />
        <span>我的</span>
      </button>
    </nav>
  )
}

function DocsFolderIcon() {
  return (
    <svg className="home-custom-icon docs-folder-icon" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="docsFolderIconGradient" x1="22" y1="26" x2="78" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#24aaa0" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <path className="doc-sheet" d="M41 15h21l13 13v31H41Z" />
      <path className="doc-fold" d="M62 15v14h13" />
      <path className="doc-line" d="M48 37h19" />
      <path className="doc-line" d="M48 48h22" />
      <path className="folder-back" d="M18 38h22l7 8h31a6 6 0 0 1 6 6v5H18Z" />
      <path className="folder-front" d="M14 50h68c4 0 7 4 6 8l-5 22a7 7 0 0 1-7 5H21a7 7 0 0 1-7-7Z" />
    </svg>
  )
}

function HomeActionCard({ icon, label, onClick }) {
  return (
    <button className="home-action-card" type="button" onClick={onClick}>
      <span className="home-action-icon">{icon}</span>
      <span className="home-action-label">{label}</span>
    </button>
  )
}

// 主角功能卡：icon 左上 / eyebrow 右上 / 标题 + 描述 / CTA + 箭头
function FeatureCard({ icon, eyebrow, title, desc, href, onActivate }) {
  return (
    <Box
      component="a"
      href={href}
      onClick={(e) => { e.preventDefault(); onActivate?.() }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 2.5, md: 2.75 },
        borderRadius: 'var(--r-lg)',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform .25s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow .25s ease, border-color .2s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top right, rgba(15, 118, 110, 0.07) 0%, transparent 55%)',
          opacity: 0,
          transition: 'opacity .3s ease',
          pointerEvents: 'none',
        },
        '&:hover': {
          borderColor: 'rgba(15, 118, 110, 0.32)',
          boxShadow: '0 14px 30px rgba(15, 118, 110, 0.13), 0 2px 6px rgba(15, 20, 25, 0.04)',
          transform: 'translateY(-2px)',
          '& .feature-arrow': { transform: 'translate(3px, -3px)' },
          '&::before': { opacity: 1 },
        },
        '&:active': { transform: 'translateY(0)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: 'var(--r-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Box className="h-eyebrow num" sx={{ mt: 0.7 }}>{eyebrow}</Box>
      </Box>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <h2 className="h-section" style={{ marginBottom: 6, fontSize: '1.18rem', fontWeight: 700, letterSpacing: '-0.018em' }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.6, textWrap: 'pretty' }}>
          {desc}
        </p>
      </Box>
      <Box sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        mt: 'auto',
        pt: 0.5,
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--accent)',
        position: 'relative',
        zIndex: 1,
      }}>
        进入功能
        <ArrowOutwardIcon className="feature-arrow" sx={{ fontSize: 16, transition: 'transform .25s cubic-bezier(0.2, 0.7, 0.2, 1)' }} />
      </Box>
    </Box>
  )
}

function TextLink({ children, icon, onClick }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        background: 'none',
        border: 0,
        padding: '4px 2px',
        cursor: 'pointer',
        fontSize: '0.88rem',
        color: 'var(--ink-2)',
        fontFamily: 'inherit',
        transition: 'color .2s ease',
        '&:hover': { color: 'var(--accent)' },
      }}
    >
      {icon}
      {children}
    </Box>
  )
}

function Dot() {
  return <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-4)' }} />
}

// ?legal=terms|privacy → 独立的协议/隐私查看页（无需登录，登录页勾选项新标签打开）
function getLegalType() {
  if (typeof window === 'undefined') return null
  const t = new URLSearchParams(window.location.search).get('legal')
  return t === 'terms' || t === 'privacy' ? t : null
}

function Root() {
  const legalType = getLegalType()
  if (legalType) return <LegalView type={legalType} />
  return <App />
}

export default Root
