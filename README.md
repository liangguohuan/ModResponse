# ModResponse (Chrome HTTP 响应伪造/Mock 插件)

## 简介
**ModResponse** 是一个基于 Chrome Manifest V3 的强大 HTTP 拦截与 Mock 插件。它通过在网页的 Main World 中重写 `window.fetch` 和 `XMLHttpRequest`，实现了无感知的请求拦截、响应体伪造、HTTP状态码篡改、延时模拟等功能，非常适合前端开发调试与接口 Mock。

## 特性
- ✨ **Manifest V3 架构**，性能卓越，资源占用低。
- 🎨 现代极客风格的 **Glassmorphism (玻璃拟物化)** 暗黑模式界面。
- 🚀 **拦截能力**：支持原生 `fetch` 与 `XMLHttpRequest` 的拦截。
- 🎯 **多重匹配**：支持 精准匹配 (Exact)、包含 (Contains)、通配符 (Wildcard)、正则表达式 (Regex)。
- ⚙️ **请求过滤**：支持指定 HTTP Method (GET, POST, PUT, DELETE, PATCH, ALL)。
- 🛠 **高阶伪造**：
  - 自定义 HTTP 状态码 (200, 404, 500 等)。
  - 自定义响应延迟 (0 - 60000ms)，完美模拟弱网与接口超时。
  - 自定义 Response Headers (例如模拟跨域 `Access-Control-Allow-Origin`)。
  - 支持直接返回 JSON、文本、HTML、XML。内置 JSON 校验与格式化/压缩。
- 📊 **实时拦截日志**：清晰直观地查看被拦截请求的状态、耗时及匹配规则。
- 💾 **本地化配置管理**：支持规则 JSON 文件的导入与导出，内置常见模板。
- 🖥 **双形态界面**：拥有小巧的 Popup 弹窗界面与沉浸式的全屏独立 Options 工作台。

## 安装指南
1. 下载/克隆此项目目录到本地。
2. 打开 Google Chrome，在地址栏输入 `chrome://extensions/` 访问扩展程序管理页面。
3. 在页面右上角，开启 **“开发者模式” (Developer mode)**。
4. 点击左上角的 **“加载已解压的扩展程序” (Load unpacked)**。
5. 选择本项目所在文件夹 (`ModResponse`) 即可完成安装。

## 使用说明
1. 点击浏览器右上角插件图标（建议将其固定在工具栏），打开 **ModResponse 控制台**。
2. 确保顶部右上角的 **“全局开关”** 处于开启状态。
3. 点击 **“新建规则”**：
   - 填写规则名称、匹配方式及 URL 表达式 (例如 `/api/v1/user` 或正则 `.*user.*`)。
   - 填写想要伪造的 HTTP 状态码 (如 200 或 500)。
   - 在底部文本框中填入你想要返回的 Mock 数据 (例如 `{"code":200, "msg":"Success"}`)。
4. 保存规则并确保该规则开关处于开启状态。
5. 在目标网页发起匹配的请求，即可看到响应已被成功伪造！
6. 可在 **“拦截日志”** 标签页中实时查看请求是否被成功拦截。

---
> Made by Antigravity AI
