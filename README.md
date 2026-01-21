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
  专为 SubLinks 服务优化的定制版本。
</p>

## 主要特性

- **极简登录**: 直接集成 SubLinks API，支持账号密码一键登录。
- **自动配置**: 登录后自动拉取并配置订阅，无需手动操作。
- **界面增强**: 移除冗余设置，提供更清爽的用户界面。
- **一键同步**: 在配置页增加“同步 SubLinks 订阅”按钮，随时保持节点最新。
- **窗口优化**: 自定义窗口控制与无边框设计，体验更丝滑。

## 预览

|              深色模式               |               浅色模式               |
| :---------------------------------: | :----------------------------------: |
| ![Preview](./docs/preview_dark.png) | ![Preview](./docs/preview_light.png) |

## 基础功能 (继承自 Clash Verge Rev)

- 基于高性能的 Rust 和 Tauri 2 框架构建。
- 内置 [Clash.Meta(mihomo)](https://github.com/MetaCubeX/mihomo) 核心。
- 支持系统代理自动配置与守护进程。
- 可视化的配置文件与规则管理。
- 完整的 Clash 功能支持。

## 开发指南

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

### TG 频道: [@clash_verge_rev](https://t.me/clash_verge_re)

## Features

- 基于性能强劲的 Rust 和 Tauri 2 框架
- 内置[Clash.Meta(mihomo)](https://github.com/MetaCubeX/mihomo)内核，并支持切换 `Alpha` 版本内核。
- 简洁美观的用户界面，支持自定义主题颜色、代理组/托盘图标以及 `CSS Injection`。
- 配置文件管理和增强（Merge 和 Script），配置文件语法提示。
- 系统代理和守卫、`TUN(虚拟网卡)` 模式。
- 可视化节点和规则编辑
- WebDav 配置备份和同步

### FAQ

Refer to [Doc FAQ Page](https://clash-verge-rev.github.io/faq/windows.html)

### Donation

[捐助Clash Verge Rev的开发](https://github.com/sponsors/clash-verge-rev)

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

To run the development server, execute the following commands after all prerequisites for **Tauri** are installed:

```shell
pnpm i
pnpm run prebuild
pnpm dev
```

## 致谢

本项目基于 [clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev) 进行定制开发。
感谢原作者的杰出工作。

## 许可证

GPL-3.0 License. 详情请参阅 [LICENSE](./LICENSE) 文件。
