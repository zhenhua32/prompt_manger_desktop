# Prompt Manager Desktop - 启动指南

## 环境要求

- Node.js 18+
- pnpm（推荐）或 npm

## 安装依赖

```bash
cd src
pnpm install
```

## 开发模式启动

```bash
cd src
pnpm run dev
```

这会同时启动：
- Vite 开发服务器（前端热重载，端口 3000）
- Electron 主进程

## 生产构建

```bash
cd src
pnpm run build
```

## 打包应用

```bash
cd src
pnpm run package
```

打包后的应用会输出到 `src/release` 目录。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | 启动开发环境 |
| `pnpm run build` | 构建生产版本 |
| `pnpm run build:main` | 仅构建主进程 |
| `pnpm run build:renderer` | 仅构建渲染进程 |
| `pnpm run package` | 打包桌面应用 |

## 项目结构

```
src/
├── main/           # Electron 主进程
│   ├── main.ts     # 主进程入口
│   └── preload.ts  # 预加载脚本
├── renderer/       # React 渲染进程
│   ├── App.tsx     # 应用主组件
│   ├── components/ # UI 组件
│   ├── hooks/      # 自定义 Hooks
│   ├── types/      # TypeScript 类型定义
│   └── styles/     # 样式文件
├── package.json    # 项目配置
└── vite.config.ts  # Vite 配置
```

## 常见问题

### 启动时报错 "ERR_FILE_NOT_FOUND"

确保 Vite 开发服务器已启动，`dev` 命令会自动等待服务器就绪。

### 端口 3000 被占用

修改 `vite.config.ts` 中的端口配置，同时更新 `main/main.ts` 中的加载地址。
