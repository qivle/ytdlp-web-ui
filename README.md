# yt-dlp Web UI

一个基于 **FastAPI (Python)** 后端和 **Vanilla JS/CSS/HTML** 前端的轻量级、响应式且美观的 `yt-dlp` 网页版下载界面。

它旨在提供直观的视频解析、多格式/分辨率选择，并能实时展示底层的命令行下载进度与详细日志，适合在个人局域网或本地电脑上运行。

---

## ✨ 核心特性

- 🌐 **一键解析**：输入视频 URL 即可快速解析所有可用的视频及音频格式。
- 📊 **格式与大小预估**：
  - 显示所有清晰度（如 4K, 1080p, 720p 等）的视频编码格式（AVC1 / VP9 / AV01）。
  - 智能标记电视播放兼容性提示（如 `avc1` 对普通电视兼容性最好）。
  - 提供预估文件大小，方便按需选择。
- 🔄 **自动更新**：支持在网页中直接运行 `yt-dlp` 自动更新程序，时刻保持最新版以应对网站接口变化。
- 🍪 **Cookie 身份验证**：支持自动读取本地浏览器（Chrome / Firefox）的 Cookie，便于下载需要登录或有访问限制的视频。
- 📈 **透明化下载进度**：
  - 实时显示下载进度条（百分比、下载速度、预估剩余时间）。
  - 提供带 ANSI 颜色渲染的交互式实时控制台日志输出。
- 📜 **下载历史记录**：本地自带 SQLite 数据库，保存您的下载记录，防重复下载。
- 🎨 **现代化 UI**：极简美观的暗色系玻璃态（Glassmorphism）设计，支持响应式布局，完美适配手机与电脑屏幕。

---

## 🚀 快速开始 (Windows)

如果您使用的是 Windows 系统，我们提供了一键式安装与启动脚本：

1. 双击运行项目根目录下的 **`start.bat`**。
2. 脚本将自动执行以下操作：
   - 检查您电脑上是否安装了 Python 3.9+。
   - 检查并自动为您创建 Python 虚拟环境 (`venv`)。
   - 自动激活虚拟环境并安装所有依赖包（见 `requirements.txt`）。
   - 自动在浏览器中打开 `http://localhost:8088` 页面。
   - 启动 FastAPI 后端服务。

---

## 🔧 手动安装与运行 (Windows / macOS / Linux)

如果您想手动控制环境或在其他操作系统上运行，请按照以下步骤操作：

### 1. 克隆/下载项目
```bash
git clone https://github.com/您的用户名/ytdlp-web-ui.git
cd ytdlp-web-ui
```

### 2. 创建并激活虚拟环境
* **Windows (PowerShell)**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
* **macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 3. 安装依赖项
```bash
pip install -r requirements.txt
```

### 4. 运行服务
```bash
uvicorn main:app --host 0.0.0.0 --port 8088
```
启动后，在浏览器访问 `http://localhost:8088` 即可使用。

---

## 💡 重要说明与配置

### 1. 为什么某些 1080p/4K 视频无法解析或下载速度极慢？
为了应对 YouTube 的 `n-sig` (JavaScript Challenge) 限制，`yt-dlp` 需要在本地执行一段 JS 解密脚本。
* **解决方法**：请在运行本软件的电脑上**全局安装 Node.js 或 Deno**。
* 安装完成后，确保能在命令行中运行 `node -v`。`yt-dlp` 会自动检测并调用 Node.js，这样即可正常解析出所有高清格式并保证正常的下载速度。
* [Node.js 官方下载地址](https://nodejs.org/)

### 2. 关于浏览器 Cookie 导入
解析和下载时，本程序支持从本机的 Chrome 或 Firefox 提取 Cookie 以应对限制：
* 请确保在使用此功能时，对应的浏览器已关闭（由于数据库独占锁，如果浏览器正在运行，可能会导致 Cookie 读取失败并输出警告）。

---

## 📦 项目依赖

主要的 Python 包（详细版本见 [requirements.txt](file:///e:/yt-dlp%20ui/ytdlp-web-ui/requirements.txt)）：
- `fastapi` & `uvicorn` (Web 框架与异步服务器)
- `yt-dlp` (下载核心库)
- `websockets` (用于实时发送下载进度)
- `aiofiles` (异步文件读写)

---

## 📄 开源协议

本项目采用 [MIT 协议](file:///e:/yt-dlp%20ui/ytdlp-web-ui/LICENSE) 开源。您可以自由地复制、修改和分发。
