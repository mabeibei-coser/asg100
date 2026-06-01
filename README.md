# hazard-detect · 安全隐患识别

AI 驱动的安全隐患图像识别系统。用户上传现场照片 + 选择场景，星火大模型按 36 个专业场景的检查清单识别隐患，输出 JSON 报告（名称/等级/描述/规范/建议/预算）。

部署在 `https://h100.jsai100.com/a600/`。源自 `hezw02/ASG01`，由 mabeibei-coser 接管 + 改造为可入 admin-hub 后台的形态（手机号登录 + 报告自动入库）。

## 技术栈

- **前端**：React 18 + Vite + MUI（Material UI 9.x） + 玻璃拟态
- **后端**：Node.js + Express + better-sqlite3 + iron-session
- **AI**：讯飞星火 maaS multimodal（`astron-code-latest`）
- **部署**：腾讯云 Lighthouse + pm2 + nginx 反代

## 本机跑起来

```bash
# 1. 装依赖
npm install

# 2. 配 env（首次）
cp .env.local.example .env.local
# 编辑 .env.local，填 IFLYTEK_API_KEY + HAZARD_SESSION_PASSWORD
# session 密钥用：
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# 3. 启动（同时跑 vite + node server.js）
npm run dev
# vite:  http://localhost:3000
# api:   http://localhost:4001
```

## 数据库 schema

`data/hazard-detect.db`（better-sqlite3 + WAL）

```sql
users (
  id            INTEGER PK,
  phone         TEXT UNIQUE,
  created_at    INTEGER,         -- ms 时间戳
  last_login_at INTEGER
)

reports (
  id              INTEGER PK,
  user_id         INTEGER,
  user_phone      TEXT,           -- denorm，方便 admin-hub 直接 SELECT
  created_at      INTEGER,        -- ms 时间戳
  scenario        TEXT,           -- 场景 id，如 general / hospital
  scenario_label  TEXT,           -- 场景中文名
  hazard_count    INTEGER,        -- 本次识别出几条隐患
  report_json     TEXT,           -- 完整 hazards 数组 JSON
  duration_ms     INTEGER,        -- AI 耗时，KPI 用
  ip              TEXT,
  user_agent      TEXT
)
```

## 环境变量

见 `.env.local.example`。生产环境清单：

| 变量 | 必填 | 说明 |
|---|---|---|
| `IFLYTEK_API_KEY` | ✓ | 讯飞 MaaS `api-key:secret`，服务端持有，浏览器不可见 |
| `IFLYTEK_MODEL` | | 默认 `astron-code-latest` |
| `HAZARD_SESSION_PASSWORD` | ✓ | iron-session 密钥，≥32 字符，base64 推荐（避免 `$` 触发 dotenv 展开） |
| `HAZARD_COOKIE_SECURE` | | `false` 本地 dev，生产 HTTPS 留空（默认严格） |
| `HAZARD_COOKIE_PATH` | | 子路径部署填 `/a600` |
| `HAZARD_DB_PATH` | | 默认 `./data/hazard-detect.db`，admin-hub ATTACH 时用绝对路径 |
| `PORT` | | 默认 4001 |
| `VITE_BASE_PATH` | | 子路径部署填 `/a600/` |

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/login` | body `{ phone }`，11 位手机号无 OTP |
| POST | `/api/logout` | 销毁 session |
| GET | `/api/me` | 当前登录态 |
| POST | `/api/analyze` | body `{ scenario, imageBase64, mimeType }`，登录后调，调讯飞 + 入库 + 返回 `{ reportId, hazards, durationMs }` |

## 36 个场景

按 4 大类分组（详见 `src/components/ScenarioDropdown.jsx`）：

- **通用场景**：general
- **人员密集与生活服务场所（17）**：居民住宅 / 医院 / 学校 / 养老院 / 写字楼 / 商场 / 农贸市场 / 餐饮后厨 / 酒店 / 体育馆 / 交通枢纽 / 沿街商铺 / 公园广场 / 影院 KTV / 图书馆 / 文物古建 / 景区
- **工业与生产作业场所（13）**：通用仓库 / 危化品仓库 / 化工车间 / 建筑工地 / 加油站 / 工业园区 / 港口码头 / 印刷喷涂 / 有限空间 / 高处作业 / 物流分拨 / 汽车维修 / 食品加工
- **特种设施与极端风险场所（5）**：配电站 / 数据中心 / 电动车充电棚 / 地下管廊 / 露天矿山

## 接入 admin-hub

本项目已按 admin-hub 接入规范改造（手机号登录 + better-sqlite3 + WAL + 标准 reports schema）。
后续接入流程跑 `admin-hub-add-project` skill。

## 项目结构

```
hazard-detect/
├── server.js              # Express 入口（登录 + 识别 + 静态托管）
├── vite.config.js         # Vite 配置（dev proxy /api → :4001）
├── lib/
│   ├── db.js              # better-sqlite3 + schema
│   ├── session.js         # iron-session 配置
│   └── prompts.js         # buildSystemPrompt / parseResult（数据从 data/prompts.json 读）
├── src/
│   ├── App.jsx            # 主组件（登录态切换）
│   ├── main.jsx
│   ├── components/
│   │   ├── LoginForm.jsx
│   │   ├── ScenarioDropdown.jsx
│   │   ├── ImageUploader.jsx
│   │   └── ResultTable.jsx
│   ├── styles/
│   └── utils/
│       └── api.js         # 前端 API 客户端（fetchMe / login / analyze）
├── data/                  # SQLite + prompts.json 运行时数据（gitignored）
│   ├── prompts.json       # 36 场景检查清单运行时数据（由 admin-hub 维护，不要手改）
│   └── prompts.seed.json  # 首次部署种子（进 git；cp 一份成 prompts.json）
├── scripts/
│   └── export-prompts.mjs # 一次性脚本：把硬编码 prompts 导出到 JSON（已跑过）
├── docs/                  # 原作者笔记（仅参考）
├── .env.local             # 本地 dev 配置（gitignored）
└── .env.local.example
```
