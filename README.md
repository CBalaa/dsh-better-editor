# dsh-better-editor

一个给 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 用的 VSCode 级文件编辑器插件：把侧边栏原本的代码文件编辑器，替换成**只读、带语法高亮**的视图 + 一个**编辑窗口**（点击后弹出），编辑体验对齐 vscode.dev（其内核就是 [Monaco Editor](https://microsoft.github.io/monaco-editor/)）。

> **硬依赖**：本插件依赖 `dsh-better-sidebar`（`^0.18.0`）。它通过 `ctx.betterSidebar.registerFileViewer` 注册视图，并通过侧边栏的 `/sidebar/api` 读写文件；没有侧边栏它就什么也不做。

## 功能

- **只读视图**：所有文本文件（代码/配置等）默认以只读 Monaco 打开，语法高亮、折叠、括号对着色、缩进参考线，且**不占用页面首屏加载**（Monaco 按需懒加载，首次打开文件才下载）。
- **编辑窗口**：只读视图顶部「编辑」按钮 → 弹出一个可缩放、可拖动的 VSCode 式工作台（**左侧文件浏览器 + 顶部文件标签页**），完整 VSCode 编辑体验：
  - 多光标（Alt+Click / Ctrl+D）、查找替换（Ctrl+F/H）、移动行/注释/折叠、minimap、sticky scroll、F1 命令面板；
  - **TS/JS 完整语言服务**（诊断/补全/hover）、JSON 校验、CSS 颜色块、HTML 补全（语言 worker 按需加载）；
  - Ctrl/Cmd+S 保存（写回 `/sidebar/api/fs.write`），保存后就地刷新只读视图；
  - 未保存修改关闭时二次确认；截断（>512KB）文件拒绝保存以防丢数据。
- **明暗主题跟随**：语法色取 one-dark/one-light 色系，表面色消费 `--dsw-alias-*` 皮肤令牌，随 DSH 皮肤/明暗自动切换。

## 安装

已发布到 npm，直接用 DSH 自带的 CLI 安装：

```bash
# 1) 先装依赖的侧边栏（本插件通过它的 betterSidebar 服务注册查看器）
dsh plugin --profile web add dsh-better-sidebar

# 2) 再装本插件（也可固定版本：dsh-better-editor@0.1.0）
dsh plugin --profile web add dsh-better-editor
```

`dsh plugin add` 会把参数转发给 profile 目录里的 pnpm，并把声明了 `dsh.bundle` 的包追加到 `dsh.profile.bundles` 栈尾。因此**先装侧边栏、后装本插件**，加载顺序自然正确（本插件的客户端注入 `betterSidebar` 服务，必须排在侧边栏之后）。

装完**重启 web profile**（`dsh --profile web` 重新启动，或简写 `dsh web`）即可生效。

> 前置：`dsh-better-sidebar@^0.18.0`。`react` / `react-dom` / `@deepseek-ai/cordis` 由 DSH web 运行时提供，无需单独安装。

## 原理

- **只覆盖、不改侧边栏**：注册一个 `exts: []`（catch-all）的 viewer，`priority: -99`——恰好排在侧边栏内置 `code` viewer（-100）之上、`binary-download`（-50）与 image/pdf/markdown/html（0）之下。已知预览类型和二进制下载不受影响，其余文本文件一律走本编辑器。
- **懒加载**：Monaco（~5MB）打进独立 chunk（`lib/client-editor.js`），5 个语言 worker（`lib/monaco-worker-*.js`）按语言下发，全部由宿主半的 `/better-editor/bundle/*` 路由服务（与 `/api` 网关同款浏览器信任围栏，`no-cache` + ETag）。

## 开发

```bash
pnpm install
pnpm build       # tsc 声明 + tsdown 打包（host + client + chunk + 5 workers）
pnpm test        # vitest 单测（语言映射 / 主题 / 路由 / 产物契约）
pnpm typecheck
```

## 目录

```
src/index.ts              # 宿主半：/better-editor/bundle 静态路由 + 信任围栏
src/client/index.tsx      # 客户端入口：注册 FileViewerDescriptor
src/client/editor-loader.ts  # 精简 chunk 加载器（脚本注入 + externals require）
src/client/chunks/editor.tsx # 懒加载 chunk 入口
src/client/MonacoFileView.tsx # 只读视图 + 编辑按钮
src/client/MonacoEditWindow.tsx # 编辑窗口（弹窗）
src/client/monaco-{lang,themes,setup}.ts / workers/  # 语言映射 / 主题 / worker 装配
```
