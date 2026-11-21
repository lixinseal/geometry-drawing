# 几何绘图 iPad 离线版

面向 **iPad Air 3（iPadOS 18）** 和 **iPad Air 13 英寸** 的本地立体几何绘图应用。Windows 或 Jetson 只承担首次 HTTPS 部署；iPad 首次完成加载并安装到主屏幕后，由 Service Worker 缓存全部资源，可断网运行。

当前应用不包含云端、账号或 AI 解析，全部采用手动构建立体图形、辅助线、点和测量。

正式在线地址：https://lixinseal.github.io/geometry-drawing/

GitHub Actions 会在 `main` 分支更新后自动构建并发布 `dist/`。

## 功能

- 参数化生成立方体、长方体、正四面体、棱锥和棱柱。
- 点、棱、面选择和屏幕空间吸附。
- 自由点、精确距离点、坐标点、中点、垂线、平行线、平面和交点。
- 延长线：选择棱或辅助线段，从任一端点向外按指定长度延长，并生成辅助点和虚线延长段。
- 两点距离、三点角度和两边角测量。
- 左侧工具栏可收起为窄边栏，右侧工具栏采用紧凑布局，为绘图区保留更大空间。

## iPad Air 13 英寸适配状态

当前已完成 iPad Air 13 英寸典型 CSS 视口评估，但尚未在真机上完成最终验收。以下数据用于后续真机测试对照，不代表全部适配事项已经完成。

| 方向 | CSS 视口 | 默认画布 | 收起左侧栏后 |
| --- | ---: | ---: | ---: |
| 横屏 | `1366 × 1024` | 约 `802 × 910` | 约 `1036 × 910` |
| 竖屏 | `1024 × 1366` | 约 `520 × 1252` | 约 `722 × 1252` |

目前评估结果：

- 横屏和竖屏均未出现页面横向溢出，顶部工具栏保持完整。
- 左侧栏可收起为 `44px` 窄边栏，右侧紧凑工具栏继续保留。
- 3D 画布使用 ResizeObserver 更新相机比例和渲染尺寸；粗指针设备会限制设备像素比，以控制 WebGL 负载。

待以后在 iPad Air 13 真机实测后再决定是否调整：

1. 验证 Safari、主屏幕 PWA、横竖屏旋转、单指旋转、双指平移缩放和 Apple Pencil 操作。
2. 重点检查 `safe-area-inset`。当前 3D 页面尚未显式处理安全区，需要确认真机状态栏和 Home Indicator 是否遮挡内容。
3. 验证顶部按钮、左侧栏开关和窄边栏触控区域；目前部分按钮为 `32px` 至 `38px`，低于约 `44px` 的参考尺寸。
4. 评估竖屏是否默认收起左侧栏，以减少双栏同时打开时的画布压缩。
5. 处理已知的非布局问题：线上控制台提示 `rotate-3d` 图标映射缺失，可能导致“重新取景”按钮图标为空。
6. 当前页面设置 `min-width: 760px`，适合 Air 13 全屏横竖屏，但不保证更窄的 Split View 分屏。

真机测试完成前，本 README 不把上述评估项描述为已经修好。

## 目录

- `src/`：应用源码。
- `public/`：PWA Manifest、离线页和图标。
- `scripts/build-pwa.mjs`：构建后生成带版本号的 Service Worker。
- `dist/`：生产构建结果，部署时只需要这个目录。
- `Caddyfile`：局域网 HTTPS 部署配置。
- `deploy/README.md`：Caddy、证书和 iPad 安装的详细步骤。
- `verification/`：桌面与 iPad 尺寸的回归截图和测试脚本。

## 构建

在 Windows 上双击：

```text
build.cmd
```

或在 PowerShell 中执行：

```powershell
npm ci
npm run build
```

构建依次执行 TypeScript 检查、Vite 构建和 PWA 预缓存清单生成。成功时终端会显示类似：

```text
PWA service worker generated: geometry-drawing-<hash> (9 assets)
```

必须确认以下文件存在：

```text
dist/index.html
dist/sw.js
dist/manifest.webmanifest
dist/offline.html
dist/icons/apple-touch-icon-180.png
```

## 首次部署

### 方案一：Windows 或 Jetson 提供局域网 HTTPS

适用于不想使用公网服务的场景。

1. 在部署电脑安装一次 Caddy。
2. 在项目目录运行 `caddy run --config Caddyfile`。
3. 在 Windows 防火墙中允许 TCP 8443 端口。
4. 把 Caddy 本地根证书安装到 iPad，并开启完全信任。
5. iPad 与部署电脑连接同一个局域网。
6. Safari 打开 `https://<部署电脑局域网IP>:8443/`。

详细证书步骤见 `deploy/README.md`。

### 方案二：GitHub Pages 在线托管

仓库已配置 GitHub Actions，并把 `dist/` 发布到：

```text
https://lixinseal.github.io/geometry-drawing/
```

应用运行时不调用云端；GitHub Pages 只负责首次把文件送到 iPad。完成缓存后仍可断网使用。

## 安装到 iPad 主屏幕

1. 用 Safari 打开 HTTPS 地址，等待 3D 画布和全部工具出现。
2. 点击 Safari 的“共享”。
3. 选择“添加到主屏幕”。
4. 从主屏幕图标启动一次。
5. 保持页面打开数秒，让 Service Worker 完成资源缓存。
6. 关闭部署电脑或打开飞行模式。
7. 再次从主屏幕启动，确认页面、3D 画布和工具仍可使用。

注意：iPad 访问局域网地址时，普通 `http://` 不具备 Service Worker 所需的安全上下文，必须使用 HTTPS。`http://127.0.0.1` 只适合在同一台电脑上测试。

## iPad 操作

- 单指拖动：旋转视图。
- 双指拖动：平移视图。
- 双指捏合：缩放。
- Apple Pencil 点击：选择点、棱、面或执行当前构造工具。
- iPad Air 3 和第一代 Apple Pencil 没有悬停预览，吸附会在 Pencil 接触屏幕后显示。

## 更新版本

1. 修改源码后重新执行 `npm run build`。
2. 将新的 `dist/` 部署到同一 HTTPS 地址。
3. 保持联网打开一次应用，等待 Service Worker 更新。
4. 完全关闭应用后重新打开。

`sw.js` 和 `manifest.webmanifest` 使用不缓存策略，静态资源使用带构建哈希的缓存名，避免旧缓存长期残留。

## 数据与离线限制

- 场景会自动保存在 Safari 的本机存储中。
- 清理 Safari 网站数据、删除主屏幕应用或系统存储压力过大时，缓存和本地数据可能被移除。
- 重要图形请使用“保存”导出 JSON，使用“导出”生成 PNG。
- 缓存成功后不需要网络；但应用升级时仍需要重新连接到部署地址一次。
