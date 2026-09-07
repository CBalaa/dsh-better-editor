# dsh-better-editor

一个给 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 用的 VSCode 级文件编辑器插件：把侧边栏原本的代码文件编辑器，替换成**只读、带语法高亮**的视图 + 一个**编辑窗口**（点击后弹出），编辑体验对齐 vscode.dev（其内核就是 [Monaco Editor](https://microsoft.github.io/monaco-editor/)）。

> **硬依赖**：本插件依赖 `dsh-better-sidebar`（`^0.18.0`）。它通过 `ctx.betterSidebar.registerFileViewer` 注册视图，并通过侧边栏的 `/sidebar/api` 读写文件；没有侧边栏它就什么也不做。

## 功能

- **只读视图**：所有文本文件（代码/配置等）默认以只读 Monaco 打开，语法高亮、折叠、括号对着色、缩进参考线，且**不占用页面首屏加载**（Monaco 按需懒加载，首次打开文件才下载）。
- **编辑窗口**：只读视图顶部「编辑」按钮 → 弹出 90vw×85vh 的编辑窗口，完整 VSCode 编辑体验：
  - 多光标（Alt+Click / Ctrl+D）、查找替换（Ctrl+F/H）、移动行/注释/折叠、minimap、sticky scroll、F1 命令面板；
  - **TS/JS 完整语言服务**（诊断/补全/hover）、JSON 校验、CSS 颜色块、HTML 补全（语言 worker 按需加载）；
  - Ctrl/Cmd+S 保存（写回 `/sidebar/api/fs.write`），保存后就地刷新只读视图；
  - 未保存修改关闭时二次确认；截断（>512KB）文件拒绝保存以防丢数据。
- **明暗主题跟随**：语法色取 one-dark/one-light 色系，表面色消费 `--dsw-alias-*` 皮肤令牌，随 DSH 皮肤/明暗自动切换。

## 安装

```bash
dsh plugin --profile <profile> add dsh-better-editor@<version>
```

> 确保 `dsh-better-sidebar` 先装（`dsh plugin add` 追加到 bundle 栈尾，先装的侧边栏自然在前，加载顺序正确）。

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
