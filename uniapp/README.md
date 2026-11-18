# 职赢AI uni-app

微信小程序 / 后续 App 共用代码（Vue 3 + Vite）。Web 端仍在仓库 `frontend/`。

## 开发

1. 启动后端：`npm run dev`（项目根目录）或只起 FastAPI `:3002`
2. 安装依赖：`cd uniapp && npm install`
3. 编译微信小程序：`npm run dev:mp-weixin`
4. 微信开发者工具打开 **`uniapp/dist/dev/mp-weixin`**（不是 `uniapp/` 源码目录）
5. API 地址：复制 `.env.example` 为 `.env.development`，默认 `http://localhost:3002/api/v1`

可选：`npm run dev:h5` 用浏览器预览（非正式产品形态）。

以后打 App：补图标/启动图后用 `npm run dev:app` 或 HBuilderX 云打包。
