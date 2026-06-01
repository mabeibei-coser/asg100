import { useState } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Snackbar, Alert,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import * as XLSX from 'xlsx'

// 等级设计 token:统一控制桌面/手机/头部的等级配色
const LEVEL_DESIGN = {
  '高': {
    stripe: '#dc2626',
    stripeWidth: 4,
    bg: '#fef2f2',
    text: '#991b1b',
    dot: '#dc2626',
    glow: 'radial-gradient(120% 90% at 100% 0%, rgba(220,38,38,0.07), transparent 55%)',
  },
  '中': {
    stripe: '#d97706',
    stripeWidth: 3,
    bg: '#fffbeb',
    text: '#92400e',
    dot: '#d97706',
    glow: 'radial-gradient(120% 90% at 100% 0%, rgba(217,119,6,0.05), transparent 55%)',
  },
  '低': {
    stripe: '#059669',
    stripeWidth: 2,
    bg: '#ecfdf5',
    text: '#065f46',
    dot: '#059669',
    glow: 'radial-gradient(120% 90% at 100% 0%, rgba(5,150,105,0.04), transparent 55%)',
  },
}

const SCENARIO_NAMES = {
  general: '通用场景',
  residential: '居民住宅小区',
  hospital: '医院及医疗机构',
  school: '学校及教育培训机构',
  nursing_home: '养老院及福利机构',
  warehouse_general: '通用仓库',
  warehouse_chemical: '危险化学品仓库',
  chemical_workshop: '化工生产车间',
  office: '写字楼/办公楼',
  mall: '大型商场/购物中心',
  market: '农贸市场/菜市场',
  kitchen: '餐饮后厨',
  construction: '建筑工地',
  gas_station: '加油站/加气站',
  hotel: '宾馆/酒店',
  gym: '体育馆/游泳馆',
  transport: '交通枢纽（车站/地铁站/机场）',
  industrial_zone: '工业园区/厂区道路',
  street_shop: '沿街商铺',
  park: '公园/广场',
  cinema: '影院/KTV/娱乐场所',
  library: '图书馆/博物馆/展览馆',
  historic: '文物古建筑/历史街区',
  scenic: '景区/游乐场',
  port: '港口/码头',
  power_station: '电力配电站/变电站',
  data_center: '通信基站/数据中心机房',
  printing: '印刷/喷涂/涂装车间',
  confined_space: '有限空间作业现场',
  high_altitude: '高处作业/外墙清洗现场',
  ev_charging: '电动自行车集中充电棚',
  logistics: '物流分拨中心',
  auto_repair: '汽车维修/4S店',
  pipe_gallery: '地下综合管廊',
  mining: '露天矿山/采石场',
  food_processing: '食品加工车间',
}

// 预算字段末尾常带"元"单位,显示时去掉(如"¥0 - 500 元" → "¥0 - 500")
const stripYuan = (text) => (text || '').toString().replace(/\s*元\s*$/, '').trim()

// ───────── 共用子组件 ─────────

function LevelBadge({ level, size = 'sm' }) {
  const d = LEVEL_DESIGN[level] || LEVEL_DESIGN['中']
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        backgroundColor: d.bg,
        color: d.text,
        px: size === 'lg' ? 1.25 : 0.875,
        py: size === 'lg' ? 0.5 : 0.25,
        borderRadius: 0.875,
        fontSize: size === 'lg' ? '0.75rem' : '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: d.dot }} />
      {level}风险
    </Box>
  )
}

function SectionLabel({ children }) {
  return (
    <Typography
      sx={{
        display: 'inline-block',
        fontSize: '0.8125rem',
        fontWeight: 700,
        color: '#0f172a',
        letterSpacing: 0,
        mb: 0.875,
        pb: 0.375,
        borderBottom: '2px solid #1e3a5f',
      }}
    >
      {children}
    </Typography>
  )
}

// ───────── 手机端隐患卡片 ─────────

function HazardCard({ hazard, index }) {
  const d = LEVEL_DESIGN[hazard.hazard_level] || LEVEL_DESIGN['中']
  const suggestions = (hazard.rectification_suggestions || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^\d+[\.\、\s]*/, ''))

  return (
    <Box
      sx={{
        position: 'relative',
        backgroundColor: '#fff',
        borderRadius: 2.5,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 0 0 1px rgba(15,23,42,0.05)',
        backgroundImage: d.glow,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: d.stripeWidth,
          backgroundColor: d.stripe,
          borderTopLeftRadius: 2.5 * 8,
          borderBottomLeftRadius: 2.5 * 8,
        },
      }}
    >
      {/* ① 标题区:大编号 + 隐患名 + 等级 badge(对应表格:# / 隐患名称 / 等级)*/}
      <Box sx={{
        px: 2.25, pt: 2.25, pb: 1.75,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
      }}>
        {/* 大字编号(等级着色,加粗) */}
        <Typography
          className="font-mono-num"
          sx={{
            fontSize: '1.875rem',
            fontWeight: 800,
            color: d.stripe,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            flexShrink: 0,
            mt: '2px',
          }}
        >
          {index + 1}
        </Typography>

        {/* 标题 + 等级 badge(标题在上,badge 在下) */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '1.3125rem',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              mb: 0.875,
            }}
          >
            {hazard.hazard_name}
          </Typography>
          <LevelBadge level={hazard.hazard_level} size="lg" />
        </Box>
      </Box>

      {/* hairline */}
      <Box sx={{ height: 1, backgroundColor: 'rgba(15,23,42,0.06)', mx: 2.25 }} />

      {/* ② 具体描述 */}
      <Box sx={{ px: 2.25, pt: 1.5, pb: 1.75 }}>
        <SectionLabel>具体描述</SectionLabel>
        <Typography
          sx={{
            fontSize: '0.9375rem',
            lineHeight: 1.65,
            color: '#334155',
            textWrap: 'pretty',
          }}
        >
          {hazard.hazard_description}
        </Typography>
      </Box>

      {/* hairline */}
      <Box sx={{ height: 1, backgroundColor: 'rgba(15,23,42,0.06)', mx: 2.25 }} />

      {/* ③ 涉及规范 */}
      <Box sx={{ px: 2.25, pt: 1.5, pb: 1.75 }}>
        <SectionLabel>涉及规范</SectionLabel>
        <Typography
          className="font-mono-num"
          sx={{
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            color: '#475569',
            wordBreak: 'break-all',
          }}
        >
          {hazard.relevant_regulations}
        </Typography>
      </Box>

      {/* hairline */}
      <Box sx={{ height: 1, backgroundColor: 'rgba(15,23,42,0.06)', mx: 2.25 }} />

      {/* ④ 整改建议 */}
      {suggestions.length > 0 && (
        <>
          <Box sx={{ px: 2.25, pt: 1.5, pb: 1.5 }}>
            <SectionLabel>整改建议</SectionLabel>
            <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {suggestions.map((s, j) => (
                <Box
                  component="li"
                  key={j}
                  sx={{
                    display: 'flex',
                    gap: 1.125,
                    mb: j === suggestions.length - 1 ? 0 : 0.75,
                    fontSize: '0.9375rem',
                    lineHeight: 1.55,
                    color: '#334155',
                  }}
                >
                  <Box
                    className="font-mono-num"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      color: d.stripe,
                      letterSpacing: '0.02em',
                      flexShrink: 0,
                      pt: '3px',
                      minWidth: 20,
                    }}
                  >
                    {String(j + 1).padStart(2, '0')}
                  </Box>
                  <Box sx={{ flex: 1 }}>{s}</Box>
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{ height: 1, backgroundColor: 'rgba(15,23,42,0.06)', mx: 2.25 }} />
        </>
      )}

      {/* ⑤ 预算经费(与其他区块同一节奏:标题在上,值在下)*/}
      <Box sx={{ px: 2.25, pt: 1.5, pb: 2 }}>
        <SectionLabel>预算经费</SectionLabel>
        <Typography
          sx={{
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            color: '#334155',
            textWrap: 'pretty',
          }}
        >
          {stripYuan(hazard.estimated_budget)}
        </Typography>
      </Box>
    </Box>
  )
}

// ───────── 主组件 ─────────

function ResultTable({ hazards, scenario, imagePreview }) {
  const hazardList = Array.isArray(hazards) ? hazards : [hazards]
  const now = (() => {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()
  const [copySnack, setCopySnack] = useState(false)

  const levelCounts = hazardList.reduce((acc, h) => {
    const lvl = h.hazard_level || '中'
    acc[lvl] = (acc[lvl] || 0) + 1
    return acc
  }, {})

  const handleDownloadExcel = () => {
    const excelData = hazardList.map((h, i) => ({
      '序号': i + 1,
      '隐患名称': h.hazard_name,
      '隐患等级': h.hazard_level + '风险',
      '具体描述': h.hazard_description,
      '涉及规范': h.relevant_regulations,
      '整改建议': h.rectification_suggestions,
      '预算经费': h.estimated_budget,
    }))
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    worksheet['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 40 },
      { wch: 25 }, { wch: 35 }, { wch: 15 },
    ]
    const range = XLSX.utils.decode_range(worksheet['!ref'])
    for (let col = range.s.c; col <= range.e.c; col++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!worksheet[addr]) continue
      worksheet[addr].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'F8FAFC' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
    const workbook = XLSX.utils.book_new()
    const timestamp = new Date().toLocaleString('zh-CN').replace(/[\/\:\s]/g, '')
    XLSX.utils.book_append_sheet(workbook, worksheet, '隐患台账')
    XLSX.writeFile(
      workbook,
      `安全隐患台账_${SCENARIO_NAMES[scenario] || '通用'}_${timestamp}.xlsx`
    )
  }

  const handleCopy = async () => {
    let text = `安全隐患识别报告\n${'='.repeat(40)}\n`
    text += `检测场景:${SCENARIO_NAMES[scenario] || '通用'}\n`
    text += `检测时间:${new Date().toLocaleString('zh-CN')}\n`
    text += `共发现 ${hazardList.length} 个隐患\n\n`
    hazardList.forEach((h, i) => {
      text += `【隐患 ${i + 1}】${h.hazard_name} [等级:${h.hazard_level}]\n`
      text += `描述:${h.hazard_description}\n`
      text += `规范:${h.relevant_regulations}\n`
      text += `建议:${h.rectification_suggestions}\n`
      text += `预算:${h.estimated_budget}\n\n`
    })
    try {
      await navigator.clipboard.writeText(text)
      setCopySnack(true)
    } catch {
      setCopySnack(true)
    }
  }

  return (
    <Paper className="glass-card" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
      {/* ───────── 头部 ───────── */}
      <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Box sx={{ width: 3, height: 22, borderRadius: 1.5, backgroundColor: 'primary.main' }} />
          <Typography
            sx={{
              fontSize: { xs: '1.0625rem', md: '1.25rem' },
              fontWeight: 700,
              color: 'primary.main',
              letterSpacing: '-0.015em',
            }}
          >
            安全隐患识别报告
          </Typography>
        </Box>

        {/* 等级分布条 + 元数据 + 桌面端操作按钮(同一行,按钮靠右) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: { xs: 'wrap', md: 'nowrap' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            {['高', '中', '低'].map(lvl => {
              const count = levelCounts[lvl] || 0
              if (count === 0) return null
              const d = LEVEL_DESIGN[lvl]
              return (
                <Box
                  key={lvl}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 0.625,
                    px: 1.125,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: d.bg,
                    color: d.text,
                  }}
                >
                  <Typography
                    className="font-mono-num"
                    sx={{
                      fontSize: '1.0625rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {count}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1 }}>
                    {lvl}风险
                  </Typography>
                </Box>
              )
            })}
            <Typography
              sx={{
                fontSize: { xs: '0.75rem', md: '0.8125rem' },
                color: 'text.secondary',
                ml: { xs: 0, md: 0.5 },
              }}
            >
              {SCENARIO_NAMES[scenario] || '通用'} · {now}
            </Typography>
          </Box>

          {/* 桌面端按钮:与等级分布同行靠右 */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, flexShrink: 0 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadExcel}
              sx={{
                py: 0.5,
                backgroundColor: 'primary.main',
                '&:hover': { backgroundColor: 'primary.dark' },
              }}
            >
              下载台账
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              sx={{ py: 0.5 }}
            >
              复制报告
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ───────── 手机端操作按钮(平分宽度,单独一行) ───────── */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          gap: 1,
          mb: 2,
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadExcel}
          sx={{
            flex: 1,
            py: 0.875,
            backgroundColor: 'primary.main',
            '&:hover': { backgroundColor: 'primary.dark' },
          }}
        >
          下载台账
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
          sx={{ flex: 1, py: 0.875 }}
        >
          复制报告
        </Button>
      </Box>

      {/* ───────── 分析照片(仅手机端,桌面端在表格行内显示缩略图) ───────── */}
      {imagePreview && (
        <Box sx={{ mb: 2, display: { xs: 'block', md: 'none' } }}>
          <img
            src={imagePreview}
            alt="已分析照片"
            style={{
              width: '100%',
              maxHeight: 280,
              objectFit: 'cover',
              borderRadius: 10,
              border: '1px solid rgba(15,23,42,0.06)',
              display: 'block',
            }}
          />
        </Box>
      )}

      {/* ───────── 桌面端:表格 ───────── */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table
            size="small"
            sx={{
              minWidth: 820,
              '& .MuiTableCell-root': { verticalAlign: 'top', wordBreak: 'break-word' },
            }}
          >
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell width="4%" align="center">#</TableCell>
                <TableCell width="20%">隐患名称</TableCell>
                <TableCell width="7%">等级</TableCell>
                <TableCell width="25%">具体描述</TableCell>
                <TableCell width="16%">涉及规范</TableCell>
                <TableCell width="22%">整改建议</TableCell>
                <TableCell sx={{ width: 96, minWidth: 96, maxWidth: 96 }} align="right">预算经费</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hazardList.map((hazard, i) => (
                <TableRow key={i} hover>
                  <TableCell align="center">
                    <Typography
                      className="font-mono-num"
                      sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}
                    >
                      {i + 1}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.4, mb: imagePreview ? 1 : 0 }}>
                      {hazard.hazard_name}
                    </Typography>
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt={`隐患 ${i + 1} 现场照片`}
                        style={{
                          width: '100%',
                          maxWidth: 120,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 4,
                          border: '1px solid rgba(15,23,42,0.08)',
                          display: 'block',
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell><LevelBadge level={hazard.hazard_level} /></TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      {hazard.hazard_description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      className="font-mono-num"
                      variant="body2"
                      sx={{
                        fontSize: '0.78rem',
                        color: 'text.secondary',
                        wordBreak: 'break-all',
                        lineHeight: 1.5,
                      }}
                    >
                      {hazard.relevant_regulations}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box
                      component="ul"
                      sx={{ m: 0, pl: 2, fontSize: '0.8rem', lineHeight: 1.6, '& li': { mb: 0.25 } }}
                    >
                      {hazard.rectification_suggestions.split('\n').filter(s => s.trim()).map((s, j) => (
                        <li key={j}>{s.replace(/^\d+[\.\、\s]*/, '')}</li>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ width: 96, minWidth: 96, maxWidth: 96 }} align="right">
                    <Typography
                      className="font-mono-num"
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'primary.main',
                        wordBreak: 'break-word',
                        lineHeight: 1.4,
                      }}
                    >
                      {stripYuan(hazard.estimated_budget)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* ───────── 手机端:卡片列表 ───────── */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {hazardList.map((hazard, i) => (
          <HazardCard key={i} hazard={hazard} index={i} />
        ))}
      </Box>

      {/* ───────── 底部 AI 免责说明(共用) ───────── */}
      <Typography
        sx={{
          mt: 2,
          textAlign: 'center',
          fontSize: { xs: '0.7rem', md: '0.75rem' },
          color: 'text.secondary',
          fontStyle: 'italic',
        }}
      >
        以上由 AI 大模型分析识别,仅供辅助参考
      </Typography>

      {/* 复制成功提示 */}
      <Snackbar
        open={copySnack}
        autoHideDuration={2000}
        onClose={() => setCopySnack(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setCopySnack(false)}
          sx={{ borderRadius: 2 }}
        >
          报告已复制到剪贴板
        </Alert>
      </Snackbar>
    </Paper>
  )
}

export default ResultTable
