import { useState, useEffect } from 'react'
import {
  Box, Typography, Menu, MenuItem, Divider,
  Dialog, DialogTitle, DialogContent, IconButton,
  List, ListItemButton, ListItemIcon, ListItemText, ListSubheader,
  useMediaQuery
} from '@mui/material'
import {
  Star, Home, LocalHospital, School, Elderly, Warehouse, Warning,
  Business, Store, ShoppingCart, Kitchen, Construction,
  Hotel, FitnessCenter, DirectionsSubway, Factory, Storefront,
  Park, Movie, LocalLibrary, AccountBalance, BeachAccess, DirectionsBoat,
  ElectricBolt, CellTower, Print, Construction as ConstructionWork,
  TwoWheeler, LocalShipping, Plumbing,
  Terrain, FoodBank, LocalGasStation,
  KeyboardArrowDown, KeyboardArrowRight, Close
} from '@mui/icons-material'

const SCENARIO_GROUPS = [
  {
    key: 'general',
    label: '通用场景（1）',
    icon: Star,
    items: [{ id: 'general', name: '通用场景', icon: Star }],
  },
  {
    key: 'crowd',
    label: '人员密集与生活服务场所（17）',
    items: [
      { id: 'residential', name: '居民住宅小区', icon: Home },
      { id: 'hospital', name: '医院及医疗机构', icon: LocalHospital },
      { id: 'school', name: '学校及教育培训机构', icon: School },
      { id: 'nursing_home', name: '养老院及福利机构', icon: Elderly },
      { id: 'office', name: '写字楼/办公楼', icon: Business },
      { id: 'mall', name: '大型商场/购物中心', icon: Store },
      { id: 'market', name: '农贸市场/菜市场', icon: ShoppingCart },
      { id: 'kitchen', name: '餐饮后厨', icon: Kitchen },
      { id: 'hotel', name: '宾馆/酒店', icon: Hotel },
      { id: 'gym', name: '体育馆/游泳馆', icon: FitnessCenter },
      { id: 'transport', name: '交通枢纽（车站/地铁站/机场）', icon: DirectionsSubway },
      { id: 'street_shop', name: '沿街商铺', icon: Storefront },
      { id: 'park', name: '公园/广场', icon: Park },
      { id: 'cinema', name: '影院/KTV/娱乐场所', icon: Movie },
      { id: 'library', name: '图书馆/博物馆/展览馆', icon: LocalLibrary },
      { id: 'historic', name: '文物古建筑/历史街区', icon: AccountBalance },
      { id: 'scenic', name: '景区/游乐场', icon: BeachAccess },
    ],
  },
  {
    key: 'industrial',
    label: '工业与生产作业场所（13）',
    items: [
      { id: 'warehouse_general', name: '通用仓库', icon: Warehouse },
      { id: 'warehouse_chemical', name: '危险化学品仓库', icon: Warning },
      { id: 'chemical_workshop', name: '化工生产车间', icon: Factory },
      { id: 'construction', name: '建筑工地', icon: Construction },
      { id: 'gas_station', name: '加油站/加气站', icon: LocalGasStation },
      { id: 'industrial_zone', name: '工业园区/厂区道路', icon: Factory },
      { id: 'port', name: '港口/码头', icon: DirectionsBoat },
      { id: 'printing', name: '印刷/喷涂/涂装车间', icon: Print },
      { id: 'confined_space', name: '有限空间作业现场', icon: Warning },
      { id: 'high_altitude', name: '高处作业/外墙清洗现场', icon: ConstructionWork },
      { id: 'logistics', name: '物流分拨中心', icon: LocalShipping },
      { id: 'auto_repair', name: '汽车维修/4S店', icon: Construction },
      { id: 'food_processing', name: '食品加工车间', icon: FoodBank },
    ],
  },
  {
    key: 'special',
    label: '特种设施与极端风险场所（5）',
    items: [
      { id: 'power_station', name: '电力配电站/变电站', icon: ElectricBolt },
      { id: 'data_center', name: '通信基站/数据中心机房', icon: CellTower },
      { id: 'ev_charging', name: '电动自行车集中充电棚', icon: TwoWheeler },
      { id: 'pipe_gallery', name: '地下综合管廊', icon: Plumbing },
      { id: 'mining', name: '露天矿山/采石场', icon: Terrain },
    ],
  },
]

// 查找场景名
function findName(id) {
  for (const g of SCENARIO_GROUPS) {
    const item = g.items.find(i => i.id === id)
    if (item) return item.name
  }
  return '请选择场景'
}

function ScenarioDropdown({ value, onChange }) {
  const isMobile = useMediaQuery('(max-width:600px)')

  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  // 手机端：全屏 Dialog
  const [mobileOpen, setMobileOpen] = useState(false)

  // 第一层：当前选中的分类
  const [currentGroup, setCurrentGroup] = useState('general')
  // 第二层子菜单锚点
  const [subAnchorEl, setSubAnchorEl] = useState(null)

  useEffect(() => {
    // 同步当前选中场景的分组
    for (const g of SCENARIO_GROUPS) {
      if (g.items.some(i => i.id === value)) {
        setCurrentGroup(g.key)
        break
      }
    }
  }, [value])

  const handleOpen = (e) => {
    if (isMobile) setMobileOpen(true)
    else setAnchorEl(e.currentTarget)
  }
  const handleClose = () => { setAnchorEl(null); setSubAnchorEl(null) }
  const handleMobileSelect = (id) => { onChange(id); setMobileOpen(false) }

  // 点击第一层分类
  const handleGroupClick = (groupKey, e) => {
    if (groupKey === 'general') {
      onChange('general')
      handleClose()
    } else {
      setCurrentGroup(groupKey)
      setSubAnchorEl(e.currentTarget)
    }
  }

  // 点击子菜单场景
  const handleSubSelect = (id) => {
    onChange(id)
    handleClose()
  }

  const activeGroup = SCENARIO_GROUPS.find(g => g.key === currentGroup)
  const selectedName = findName(value || 'general')

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 3, height: 20, borderRadius: 1.5, backgroundColor: 'primary.main' }} />
        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
          选择检查场景
        </Typography>
      </Box>

      {/* 触发按钮 */}
      <Box
        onClick={handleOpen}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', minHeight: 48, px: 2, py: 1,
          borderRadius: 1,
          border: '1px solid', borderColor: open ? 'primary.main' : 'rgba(0,0,0,0.23)',
          cursor: 'pointer', backgroundColor: '#fff',
          transition: 'border-color 0.2s',
          '&:hover': { borderColor: 'rgba(0,0,0,0.5)' },
        }}
      >
        <Typography sx={{ fontSize: '0.95rem' }}>{selectedName}</Typography>
        <KeyboardArrowDown sx={{ color: 'text.secondary' }} />
      </Box>

      {/* 第一层菜单：4 个分类 */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{ sx: { minWidth: 260 } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {SCENARIO_GROUPS.map((group) => {
          const GroupIcon = group.icon
          const isCurrent = currentGroup === group.key
          return (
            <MenuItem
              key={group.key}
              onClick={(e) => handleGroupClick(group.key, e)}
              sx={{
                backgroundColor: isCurrent ? '#f0f4ff' : 'transparent',
                '&:hover': { backgroundColor: '#f5f6f8' },
                display: 'flex', justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {GroupIcon && <GroupIcon sx={{ fontSize: 20, color: 'primary.main' }} />}
                <Typography sx={{ fontSize: '0.9rem', fontWeight: isCurrent ? 600 : 400 }}>
                  {group.label}
                </Typography>
              </Box>
              {group.key !== 'general' && (
                <KeyboardArrowRight sx={{ fontSize: 20, color: 'text.secondary' }} />
              )}
            </MenuItem>
          )
        })}
      </Menu>

      {/* 第二层菜单：具体场景（仅桌面端使用） */}
      {activeGroup && activeGroup.items.length > 1 && (
        <Menu
          anchorEl={subAnchorEl}
          open={Boolean(subAnchorEl)}
          onClose={() => setSubAnchorEl(null)}
          MenuListProps={{ sx: { minWidth: 240, maxHeight: 420 } }}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          {activeGroup.items.map((item) => {
            const IconComponent = item.icon
            const isSelected = value === item.id
            return (
              <MenuItem
                key={item.id}
                onClick={() => handleSubSelect(item.id)}
                sx={{
                  borderLeft: isSelected ? '3px solid' : '3px solid transparent',
                  borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                  backgroundColor: isSelected ? '#e8edf5' : 'transparent',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <IconComponent sx={{ fontSize: 18, color: isSelected ? 'primary.main' : 'text.secondary' }} />
                  <Typography sx={{
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'primary.main' : 'text.primary',
                  }}>
                    {item.name}
                  </Typography>
                </Box>
              </MenuItem>
            )
          })}
        </Menu>
      )}

      {/* 手机端：全屏 Dialog，所有场景按分组扁平展示 */}
      <Dialog
        fullScreen
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { backgroundColor: '#f4f6f9' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)',
            py: 1.5, px: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>选择检查场景</Typography>
          <IconButton onClick={() => setMobileOpen(false)} size="small" aria-label="关闭">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List sx={{ pt: 0, pb: 2 }}>
            {SCENARIO_GROUPS.map((group) => (
              <Box key={group.key}>
                <ListSubheader
                  sx={{
                    backgroundColor: '#f4f6f9',
                    fontWeight: 600,
                    color: 'text.primary',
                    fontSize: '0.8rem',
                    lineHeight: '36px',
                    px: 2,
                  }}
                >
                  {group.label}
                </ListSubheader>
                {group.items.map((item) => {
                  const IconComponent = item.icon
                  const isSelected = value === item.id
                  return (
                    <ListItemButton
                      key={item.id}
                      onClick={() => handleMobileSelect(item.id)}
                      sx={{
                        backgroundColor: isSelected ? '#e8edf5' : '#fff',
                        borderLeft: '3px solid',
                        borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                        py: 1.25, px: 2,
                        '&:hover': { backgroundColor: isSelected ? '#e8edf5' : '#f8fafc' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <IconComponent sx={{ fontSize: 20, color: isSelected ? 'primary.main' : 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        primaryTypographyProps={{
                          fontSize: '0.95rem',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'primary.main' : 'text.primary',
                        }}
                      />
                    </ListItemButton>
                  )
                })}
              </Box>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  )
}

export default ScenarioDropdown
