# 构建指南

## 概述

本项目使用 `.env` 文件管理构建配置（API 地址、版本号等）。`.env` 文件不提交到 Git，CI 构建时从 GitHub Secrets 动态生成。

## 配置文件说明

| 文件               | 用途             | 是否提交 |
| ------------------ | ---------------- | -------- |
| `.env.example`     | 配置模板，供参考 | 是       |
| `.env.development` | 本地开发配置     | 否       |
| `.env.production`  | 本地发布构建配置 | 否       |

### 环境变量

| 变量名             | 说明                 | 示例                                |
| ------------------ | -------------------- | ----------------------------------- |
| `APP_VERSION`      | 应用版本号（SemVer） | `1.3.1`                             |
| `SUBLINKS_API_URL` | SubLinks API 地址    | `https://sub.135150.xyz`            |
| `UPDATE_API_URL`   | 更新服务地址         | `https://vermanager-api.135150.xyz` |
| `UPDATE_APP_NAME`  | 更新应用名称         | `sublinks-client-desktop`           |
| `UPDATE_ENABLED`   | 是否启用更新         | `true`                              |

## 本地开发

### 首次设置

```bash
# 1. 从模板创建开发配置
cp .env.example .env.development

# 2. 编辑 .env.development，填入实际值
# APP_VERSION=1.3.0
# SUBLINKS_API_URL=http://localhost:3001
# ...

# 3. 安装依赖
pnpm i
```

### 日常开发

```bash
pnpm tauri dev
```

### 本地发布构建

```bash
# 1. 确保 .env.production 存在且配置正确
cp .env.example .env.production
# 编辑 .env.production...

# 2. 构建
pnpm tauri build
```

## GitHub CI 构建

### 首次设置：配置 GitHub Secrets

在仓库 **Settings > Secrets and variables > Actions** 中添加：

| Secret 名称        | 说明              | 示例                                |
| ------------------ | ----------------- | ----------------------------------- |
| `SUBLINKS_API_URL` | SubLinks API 地址 | `https://sub.135150.xyz`            |
| `UPDATE_API_URL`   | 更新服务地址      | `https://vermanager-api.135150.xyz` |
| `UPDATE_APP_NAME`  | 更新应用名称      | `sublinks-client-desktop`           |
| `UPDATE_ENABLED`   | 是否启用更新      | `true`                              |

配置一次即可，后续无需修改。

### 发布新版本

```bash
# 1. 修改本地 .env.production 的版本号
#    APP_VERSION=1.3.1

# 2. 同步版本号到 package.json / tauri.conf.json / Cargo.toml
node scripts/sync-version.mjs production

# 3. 提交版本变更
git add -A
git commit -m "chore: bump version to 1.3.1"

# 4. 打 tag 并推送（触发 CI 自动构建）
git tag v1.3.1
git push origin sublinks --tags
```

推送后 GitHub Actions 自动执行：

1. 从 Secrets 读取配置，从 tag 提取版本号
2. 动态生成 `.env.production`
3. 运行 `sync-version.mjs` 确保版本一致
4. 构建 Windows / macOS / Linux 全平台安装包
5. 创建 GitHub Release

### 手动测试构建

在 GitHub Actions 页面找到 **Dev Test** (`dev.yml`)，点击 **Run workflow**，选择要构建的平台。构建完成后在 Artifacts 中下载。

### 定时自动构建

**Auto Build** (`autobuild.yml`) 每天 UTC 4:00 和 10:00（北京时间 12:00 和 18:00）自动从 `dev` 分支构建预发布版。

## CI Workflow 一览

| Workflow             | 触发方式          | 用途                     |
| -------------------- | ----------------- | ------------------------ |
| `release.yml`        | 推送 `v*.*.*` tag | 正式发布，构建全平台     |
| `autobuild.yml`      | 定时 + 手动       | 每日自动构建预发布版     |
| `dev.yml`            | 手动              | 测试构建，上传 Artifacts |
| `lint-clippy.yml`    | PR                | Rust 代码检查            |
| `frontend-check.yml` | PR                | 前端代码检查             |
| `rustfmt.yml`        | PR                | Rust 格式检查            |

## 版本号管理

版本号的流向：

```
.env.production (APP_VERSION)
        │
        ▼
  sync-version.mjs
        │
        ├─▶ package.json (version)
        ├─▶ src-tauri/tauri.conf.json (version)
        └─▶ src-tauri/Cargo.toml (version)
```

- **本地构建**：从 `.env.production` 读取版本号，通过 `sync-version.mjs` 同步
- **CI 构建**：从 git tag 提取版本号，动态写入 `.env.production`，再同步
- **Auto Build / Dev Test**：由 `release-version.mjs` 自动生成带时间戳的版本号

## 常见问题

### Q: 为什么 `.env` 文件不提交？

`.env` 包含环境相关的配置（API 地址等），不同环境（开发/生产）值不同。通过 GitHub Secrets 管理，避免配置泄露和频繁修改。

### Q: 本地构建报错找不到环境变量？

确保项目根目录下存在 `.env.development` 或 `.env.production` 文件。可以从 `.env.example` 复制并填入实际值。

### Q: CI 构建版本号不对？

确保：

1. `package.json` 的 version 和 git tag 一致（如 tag 为 `v1.3.1`，则 version 为 `1.3.1`）
2. 推送前已运行 `node scripts/sync-version.mjs production`
