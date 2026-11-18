# 职赢AI 微信小程序

已对接后端 FastAPI（默认 `http://localhost:3002/api/v1`）。

## 功能

- 登录/注册（JWT）
- 简历上传与 AI 诊断（含语法排版检测）
- 模拟面试（选角色、文字作答）
- 复盘报告页（逐题反馈）
- 名企冲刺包
- 会员购买（模拟支付）

## 开发

1. 启动后端：`npm run dev`（项目根目录）
2. 微信开发者工具打开 `miniprogram/` 目录
3. 修改 `app.js` 中 `apiBase` 为实际后端地址
4. `project.config.json` 已关闭 urlCheck 便于本地调试

## 页面

- `pages/index` — 首页导航
- `pages/login` — 登录注册
- `pages/resume` — 简历上传分析
- `pages/interview` — 模拟面试
