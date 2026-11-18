# 职赢AI — AI求职与模拟面试官

基于职场大模型的一站式 AI 求职助手：简历深度诊断、JD 匹配、STAR 重写、全真模拟面试与复盘报告。

## 功能

- **用户系统**：注册/登录（JWT），多用户隔离
- **简历智能工作台**：PDF/Word/TXT 解析、多维度体检、JD 匹配度、STAR 交互重写
- **AI 模拟面试**：4 类面试官、15 行业、文字/语音、WebSocket 语音链路
- **名企冲刺包**：字节/阿里/腾讯/华为/麦肯锡真题训练（199元/次）
- **会员与支付**：月卡/季卡/冲刺包（开发环境模拟支付）
- **面试复盘报告**：雷达图、逐题评分、录音回放、逐字稿口头禅标注
- **微信小程序**：`miniprogram/` 已对接登录、简历、模拟面试 API

## 技术栈

详见 [docs/TECH_STACK.md](docs/TECH_STACK.md) | 数据库设计 [docs/DATABASE.md](docs/DATABASE.md)

- 前端：React + Vite + Tailwind CSS
- 后端：Python + FastAPI + SQLite
- AI：OpenAI 兼容 API（简历分析必需；模拟面试无 Key 时可规则降级）

## 快速开始

```bash
# 安装后端依赖
cd backend && pip install -r requirements.txt

# 安装前端依赖
cd ../frontend && npm install

# 数据库迁移（在项目根目录）
npm run db:migrate

# 启动开发（项目根目录，同时启动前后端）
npm run dev
```

- 前端：http://localhost:5174
- 后端 API：http://localhost:3002

### 启用大模型（简历分析必需）

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 OPENAI_API_KEY（简历诊断/匹配/STAR 重写依赖大模型）
```

## 项目结构

```
├── backend/           # FastAPI
│   └── app/
│       ├── db/        # Schema + 迁移
│       ├── routes/    # REST 路由
│       └── services/  # 简历解析、诊断、面试引擎
├── frontend/          # React SPA
│   └── src/
│       ├── pages/     # 简历工作台、模拟面试、复盘报告
│       └── hooks/     # 语音 ASR/TTS
└── docs/              # 技术文档
```

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/auth/register | 注册 |
| POST | /api/v1/auth/login | 登录 |
| GET | /api/v1/payments/plans | 套餐列表 |
| GET | /api/v1/payments/plans | 套餐列表（无需登录） |
| GET | /api/v1/payments/orders | 我的订单 |
| POST | /api/v1/payments/checkout | 创建订单 |
| POST | /api/v1/payments/confirm/:id | 确认支付（开发环境模拟支付） |
| POST | /api/v1/payments/wechat/prepay | 微信预支付（stub） |
| GET | /api/v1/admin/catalog/industries | 行业题库管理 |
| GET | /api/v1/admin/catalog/enterprise | 名企题库管理 |
| POST | /api/v1/resumes/upload | 上传简历并分析 |
| POST | /api/v1/interviews/enterprise/sessions | 名企冲刺训练 |
| WS | /api/v1/voice/ws | 实时语音 WebSocket |

完整 API 需 Bearer Token 认证（除 auth 与 plans）。

## 产品文档

完整 PRD 见 [AI求职与模拟面试官.md](AI求职与模拟面试官.md)
