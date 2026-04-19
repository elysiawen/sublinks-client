<h1 align="center">
  <img src="./src-tauri/icons/icon.png" alt="SubLinks Client" width="128" />
  <br>
  SubLinks 客户端
  <br>
</h1>

<h3 align="center">
基于 <a href="https://github.com/clash-verge-rev/clash-verge-rev">Clash Verge Rev</a> 定制的 SubLinks 专属客户端。
</h3>

<p align="center">
  专为 SubLinks 服务优化的定制版本，提供独立的运行环境与流畅的更新体验。
</p>

## Install

请到发布页面下载对应的安装包：[Release page](https://github.com/clash-verge-rev/clash-verge-rev/releases)<br>
Go to the [Release page](https://github.com/clash-verge-rev/clash-verge-rev/releases) to download the corresponding installation package<br>
Supports Windows (x64/x86), Linux (x64/arm64) and macOS 11+ (intel/apple).

#### 我应当怎样选择发行版

| 版本        | 特征                                     | 链接                                                                                   |
| :---------- | :--------------------------------------- | :------------------------------------------------------------------------------------- |
| Stable      | 正式版，高可靠性，适合日常使用。         | [Release](https://github.com/clash-verge-rev/clash-verge-rev/releases)                 |
| Alpha(废弃) | 测试发布流程。                           | [Alpha](https://github.com/clash-verge-rev/clash-verge-rev/releases/tag/alpha)         |
| AutoBuild   | 滚动更新版，适合测试反馈，可能存在缺陷。 | [AutoBuild](https://github.com/clash-verge-rev/clash-verge-rev/releases/tag/autobuild) |

#### 安装说明和常见问题，请到 [文档页](https://clash-verge-rev.github.io/) 查看

---

## 主要定制特性

### 1. SubLinks 核心集成

- **极简登录**: 直接集成 SubLinks API，支持账号密码一键登录，摆脱繁琐的 URL 配置。
- **全自动配置**: 登录后自动从云端拉取、解析并配置所有订阅节点，实现“开箱即用”。
- **一键同步**: 在配置页增加“同步 SubLinks 订阅”按钮，随时保持节点信息的即时同步。

### 2. 独立运行环境 (Rebranding)

- **品牌重塑**: 全面更名为 **SubLinks Client**，拥有独立的图标与产品标识 (`com.sublinks.client`)。
- **路径隔离**: 使用独立的数据存储路径 (`AppData/Roaming/sublinks`)，不与原版 Clash Verge 共享配置，方便多版本并存。
- **备份优化**: 拥有独立的本地备份系统 (`sublinks-backup`)。

### 3. 高级更新系统 (Enhanced Update System)

- **药丸式提醒**: 首页采用全新设计的“药丸”风格更新提示条，支持毛玻璃背景、平滑下滑动画及 Material Icons。
- **智能报错逻辑**:
  - **手动检查**: 点击检查更新时，会明确告知用户是“已经是最新版本”还是“网络连接失败”，不再统一提示“已经是最新版”。
  - **后台检查**: 应用启动时的自动检查保持静默报错，不干扰正常使用。
- **自主控制**: 在“高级设置”中可手动开启/关闭“自动检查更新”功能。
- **全域开关**: 支持通过环境变量 `UPDATE_ENABLED` 全局禁用所有更新相关 UI（包括按钮、弹窗和设置项）。

---

## Features

- **SubLinks Native Support**: Integrated API for seamless account authentication and profile synchronization.
- **Environment Isolation**: Fully independent data directory (`sublinks`) and application identifier (`com.sublinks.client`), co-existing safely with original Clash Verge versions.
- **Premium Update Experience**:
  - Aesthetic "Pill-style" notification bar with `BackdropFilter` blur and smooth Entrance animations.
  - Transparent error reporting: clearly distinguishes between "Network Connection Failure" and "Already Latest Version" during manual checks.
  - Granular control over auto-update logic in Advanced and Miscellaneous settings.
- **Continuous Improvement**: Successfully merged the latest `upstream/dev` branch for top-tier stability and kernel performance.
- **Modern Tech Stack**: Built with performance-oriented **Rust** and the latest **Tauri v2** framework.
- **Clean Aesthetic**: Simplified UI layouts, refined iconography, and reduced configuration clutter.

---

## 开发与编译指南

### 1. 环境准备

本项目需要 **Rust** (1.75+) 和 **Node.js** (18+) 环境。

- **Windows 用户**: 推荐使用 MSVC 工具链，并安装 GNU `patch` 工具。
- **macOS/Linux 用户**: 确保已安装必要的编译依赖（如 `webkit2gtk`, `libayatana-appindicator` 等）。

### 2. 初始化项目

启用 `corepack` 并安装依赖：

```shell
corepack enable
pnpm install
```

下载必要的内核二进制文件（SubLinks 专属内核）：

```shell
pnpm run prebuild
```

### 3. 环境配置 (.env)

项目使用 [Vite 环境变量](https://cn.vitejs.dev/guide/env-and-mode.html) 进行配置。你可以通过根目录下的 `.env`（或 `.env.development` 等）文件定制行为：

| 变量名             | 默认值  | 说明                                                       |
| :----------------- | :------ | :--------------------------------------------------------- |
| `UPDATE_ENABLED`   | `true`  | **更新系统总开关**。设置为 `false` 将完全隐藏所有更新 UI。 |
| `SUBLINKS_API_URL` | -       | SubLinks API 的基础地址。                                  |
| `UPDATE_API_URL`   | -       | 检查更新的 API 终点（返回 `version` 信息的 JSON）。        |
| `UPDATE_APP_NAME`  | -       | 用于更新请求的应用名称标识。                               |
| `APP_VERSION`      | `1.0.0` | 客户端当前显示的版本号。                                   |

> [!TIP]
> 变量前缀 `UPDATE_`, `SUBLINKS_`, `APP_` 均已在 `vite.config.ts` 中配置为自动暴露给前端。

### 4. 常用命令

- **本地开发**: `pnpm dev`
- **正式打包**: `pnpm build`
- **代码规范**: `pnpm lint` / `cargo clippy-all`
- **代码格式化**: `pnpm format` / `cargo fmt`

### 5. 定制化开发说明

- **数据目录**: 后端 ID 在 `src-tauri/src/utils/dirs.rs` 中定义为 `sublinks`。
- **国际化**: 多语言文件位于 `src/locales/`，更新文案后需运行相应的同步脚本。
- **自定义内核**: 如需更换内置的 Mihomo 内核，请修改 `crates/clash-verge-draft` 相关的资源引用。

---

## Development & Build Guide

### 1. Prerequisites

- **Rust** (1.75+)
- **Node.js** (18+)
- **pnpm** (via Corepack)

### 2. Setup & Initialization

```shell
pnpm install
pnpm run prebuild  # Download core binaries
```

### 3. Environment Variables

Customize the client behavior by editing `.env`. The following prefixes are exposed to the frontend: `UPDATE_`, `SUBLINKS_`, `APP_`.

| Variable           | Default | Description                                                  |
| :----------------- | :------ | :----------------------------------------------------------- |
| `UPDATE_ENABLED`   | `true`  | **Master Switch**. Hides all update-related UI when `false`. |
| `SUBLINKS_API_URL` | -       | Base URL for SubLinks API services.                          |
| `UPDATE_API_URL`   | -       | Endpoint URL for fetching update metadata (JSON).            |
| `UPDATE_APP_NAME`  | -       | App identifier used in update requests.                      |
| `APP_VERSION`      | `1.0.0` | The version string displayed and used for comparison.        |

### 4. Commands

| Command       | Description                           |
| :------------ | :------------------------------------ |
| `pnpm dev`    | Start development server with HMR     |
| `pnpm build`  | Bundle and build production installer |
| `pnpm lint`   | Run ESLint and Cargo Clippy           |
| `pnpm format` | Auto-format frontend and backend code |

### 5. Architecture Notes

- **App ID**: Hardcoded as `com.sublinks.client` in Tauri configs and `sublinks` in Rust utils.
- **Upstream Sync**: This repo periodically merges from `clash-verge-rev/clash-verge-rev` dev branch.

## 致谢

本项目基于 [clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev) 进行定制开发。
感谢原作者团队在 Clash 客户端领域所做的杰出贡献。

## 许可证

GPL-3.0 License. 详情请参阅 [LICENSE](./LICENSE) 文件。
