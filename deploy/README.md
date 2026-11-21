# iPad Air 3 首次部署与离线安装

当前 GitHub Pages 地址：

```text
https://lixinseal.github.io/geometry-drawing/
```

GitHub Actions 会自动构建并发布。下面的 Caddy 内容是局域网 HTTPS 部署备选方案。

## 1. 构建

```powershell
npm ci
npm run build
```

构建结束后只部署 `dist/`，不要把 `src/` 或 `node_modules/` 上传到静态站点。

## 2. Caddy 局域网 HTTPS

`Caddyfile` 已使用 `tls internal`：

```caddyfile
:8443 {
  tls internal
  root * ./dist
  encode zstd gzip
  file_server
  try_files {path} /index.html

  header /sw.js Cache-Control "no-cache"
  header /manifest.webmanifest Cache-Control "no-cache"
}
```

在项目目录运行：

```text
caddy run --config Caddyfile
```

访问地址：

```text
https://<Windows或Jetson局域网IP>:8443/
```

不要使用 `127.0.0.1`，因为 iPad 上的 `127.0.0.1` 指向 iPad 自己。

## 3. Windows 防火墙

第一次运行 Caddy 时，如果 Windows 弹出防火墙提示，允许专用网络访问。也可以手动创建入站规则，开放 TCP 8443，并仅允许本地局域网。

检查端口：

```powershell
Test-NetConnection <部署电脑局域网IP> -Port 8443
```

## 4. 安装 Caddy 根证书到 iPad

Caddy 第一次启动会生成本地 CA。常见根证书位置：

```text
Windows: %AppData%\Caddy\pki\authorities\local\root.crt
Linux/Jetson: ~/.local/share/caddy/pki/authorities/local/root.crt
```

如果目录不同，以 Caddy 实际数据目录为准。把 `root.crt` 传到 iPad 后：

1. 在 iPad 上打开 `root.crt`，按提示下载描述文件。
2. 打开“设置 → 通用 → VPN 与设备管理”，安装该描述文件。
3. 打开“设置 → 通用 → 关于本机 → 证书信任设置”。
4. 对 Caddy 本地根证书开启完全信任。

没有完成完全信任时，Safari 可能能打开页面，但 Service Worker 或安全资源会失败。

## 5. 添加到主屏幕

1. Safari 打开 `https://<局域网IP>:8443/`。
2. 等待 3D 画布和右侧工具出现。
3. 点击“共享 → 添加到主屏幕”。
4. 从主屏幕启动应用。
5. 等待数秒后关闭部署电脑，或者把 iPad 切换到飞行模式。
6. 重新启动主屏幕应用，确认仍能正常显示和操作。

## 6. 离线验收清单

- 页面标题和应用图标正常。
- 正方体或棱锥的 3D 画布正常显示。
- 点、棱、面可以点选。
- 辅助线工具和测量工具可以切换。
- 关闭服务器后重新打开，应用仍能进入。
- 保存 JSON、打开 JSON、导出 PNG 正常。

## 7. 更新与排错

更新时重新构建并将 `dist/` 覆盖到同一地址。保持联网打开应用一次，让新 Service Worker 接管。

如果离线启动失败：

1. 确认地址是 `https://`，不是局域网 `http://`。
2. 确认 Caddy 根证书已完全信任。
3. 在 Safari 中打开一次应用，等待缓存完成。
4. 检查 Safari 网站数据是否被清理。
5. 在桌面浏览器访问 `https://<IP>:8443/sw.js`，确认文件可以下载。
