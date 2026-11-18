# 技术栈选型

## 总览

| 层级 | 选型 | 说明 |
|------|------|------|
| 前端 | React 18 + Vite + TypeScript + Tailwind CSS | 快速开发、组件化 UI |
| 后端 | Python 3.13 + FastAPI | 轻量 API，AI 生态友好，无原生模块问题 |
| 数据库 | SQLite (stdlib) | 零配置本地开发，可迁移 PostgreSQL |
| LLM | OpenAI 兼容 API | 简历分析必需；模拟面试等无 Key 时可规则降级 |
| 简历解析 | pdf-parse + mammoth | PDF / Word 文本提取 |
| 语音 (Phase 2) | Web Speech API | 浏览器端 ASR + TTS，零后端语音成本 |
| 文件存储 | 本地 `uploads/` | MVP 阶段；可换 R2/S3 |
| 部署 | Docker Compose | 前后端分离，生产可上 Railway / VPS |

## 目录结构

```
AIJobMockInterview/
├── backend/          # FastAPI 服务
├── frontend/         # React SPA
├── docs/             # 技术文档
└── docker-compose.yml
```

## 环境变量

### Backend (`backend/.env`)

```
PORT=3002
DATABASE_URL=./data/careerai.db
OPENAI_API_KEY=           # 简历分析必需；留空则简历上传/分析不可用
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4   # 智谱；OpenAI 用 https://api.openai.com/v1
OPENAI_MODEL=glm-4.5-air   # 智谱；OpenAI 可用 gpt-4o-mini
UPLOAD_DIR=./uploads
```

注意：`OPENAI_BASE_URL` 仅填 API 根路径，不要包含 `/chat/completions`。

## API 设计原则

- RESTful JSON API，前缀 `/api/v1`
- 统一错误格式 `{ error: string, code?: string }`
- MVP 使用 demo 用户（`X-User-Id` header），后续可接 JWT
