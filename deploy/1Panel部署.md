# 使用 1Panel + OpenResty 部署

目标域名：**landlord.luminestella.top**  
源代码仓库：https://github.com/L1ke40oz/ai-landlord

这是静态网站，OpenResty 直接提供 HTML、CSS、JS 文件。不需要 Node.js 运行环境、数据库、反向代理或后台常驻进程。

## 1. 配置域名

在 `luminestella.top` 的 DNS 管理中，为 `landlord` 添加 A 记录，指向 VPS 的公网 IPv4。只有 VPS 的 IPv6 也正确配置时才添加 AAAA 记录。

服务器防火墙和云服务商安全组需允许网站使用的 80 / 443 端口。

## 2. 在 1Panel 创建静态网站

在「网站 → 创建网站」中选择「静态网站」，主域名填写 `landlord.luminestella.top`。如果网站已创建，直接使用已有站点。

默认文档设为 `index.html`。本游戏不需要 PHP、反向代理、伪静态或 SPA 回退规则。

打开该网站设置中的「网站目录」，复制**宿主机上的实际网站根目录**。不同版本和安装位置的路径可能不同，以面板显示为准。不要把 OpenResty 容器配置中 `/www/...` 一类的容器内路径，直接当成 VPS 宿主机路径使用。

官方参考：[创建网站](https://docs.fit2cloud.com/1panel/user_manual/websites/website-create/)、[网站目录与 HTTPS 设置](https://1panel.pro/docs/v2/user_manual/websites/website_config_basic/)。

## 3. 从 GitHub 拉取并部署

在 **VPS 宿主机终端**执行（例如 1Panel 的主机终端，而非 OpenResty 容器终端）。服务器需有 Git 和 Bash；若提示 `git: command not found`，先使用服务器发行版的软件包管理器安装 Git。

首次拉取：

```bash
git clone https://github.com/L1ke40oz/ai-landlord.git /opt/ai-landlord
cd /opt/ai-landlord
```

将下面变量替换为第 2 步从 1Panel 复制的网站根目录，再执行：

```bash
SITE_ROOT='/替换为1Panel显示的实际网站根目录'
bash deploy/deploy.sh "$SITE_ROOT"
```

部署脚本只复制：

```text
网站根目录/
├─ index.html
├─ styles.css
├─ scene.css
├─ game-data.js
├─ scene.js
└─ game.js
```

文件必须直接出现在站点根目录，不能多嵌套一层 `ai-landlord/`。`index.html` 应与其引用的五个资源文件处于同一级目录。

脚本会先把目标目录中已有的同名文件备份到**运行账号的** `~/.local/state/ai-landlord/backups/`；如果设置了 `XDG_STATE_HOME`，会放到该状态目录中。可通过环境变量 `AI_LANDLORD_BACKUP_DIR` 指定备份目录。脚本会打印实际备份路径。它不会清空网站目录，也不会修改 OpenResty 配置。

复制新静态文件后通常即可访问，不需要重启 OpenResty。如果目录不可写，使用能管理该站点的账户运行。文件保持 644 权限；目录权限使用 1Panel 为静态站点创建的默认设置。

## 4. HTTPS

先访问 `http://landlord.luminestella.top` 确认游戏加载。

在 1Panel 中为该域名申请或导入证书，再进入网站的「HTTPS」设置启用证书。具体入口名称随版本略有差异，使用面板的证书和 HTTPS 管理即可。

启用 HTTPS 后访问 `https://landlord.luminestella.top`，确认游戏可运行，再按需要启用 HTTP 自动跳转 HTTPS。使用 HTTP 验证申请证书时，需保证 DNS 已生效且外部能够访问 80 端口；也可使用面板提供的 DNS 验证。

HTTP 和 HTTPS 的浏览器本地存档分别保存，首次使用 HTTPS 时会是独立的新进度。

## 5. 可选：缓存与 OpenResty 配置

保持 1Panel 默认静态网站配置即可运行。本项目没有前端路由，不需要 `try_files $uri /index.html`。

如果希望每次更新后浏览器都检查脚本是否变更，可以参考同目录 `openresty-1panel.conf`。它是**添加到现有 `server { ... }` 内的片段**，不是完整配置文件。1Panel 已生成的 `listen`、`server_name`、`root`、HTTPS 证书及 ACME 验证配置都要保留；同名 `location` 已存在时修改原块，避免重复定义。

这个版本的 CSS/JS 文件名不包含内容哈希，不适合设置一年强缓存或 `immutable`。`Cache-Control: no-cache` 允许浏览器缓存，但要求复用前向服务器确认是否变化。

修改配置后，使用 1Panel 的配置检查/保存功能。如果用终端执行 `nginx -t`，应在 1Panel 管理的 **OpenResty 容器终端**中操作，检查通过后再 `nginx -s reload`；不要对宿主机上的另一个 Nginx 实例执行命令。

官方参考：[Nginx 静态文件与配置](https://nginx.org/en/docs/beginners_guide.html)、[缓存响应头](https://nginx.org/en/docs/http/ngx_http_headers_module.html)、[配置检查及重载参数](https://nginx.org/en/docs/switches.html)。

## 6. 后续更新

```bash
cd /opt/ai-landlord
git pull --ff-only origin main
SITE_ROOT='/替换为1Panel显示的实际网站根目录'
bash deploy/deploy.sh "$SITE_ROOT"
```

不会自动清理玩家本地存档。需要强制重新开局时，玩家可在游戏「系统 → 重新开始」操作。

要恢复旧版本，从脚本打印的备份路径中复制旧的六个文件回网站根目录即可。如果首次部署前只有 1Panel 的默认 `index.html`，备份中只有这个文件；这种备份只能恢复默认入口，不能当作旧版游戏。

## 7. 无 Git 的面板上传方式

也可以从仓库下载 ZIP，在本地解压，只选择第 3 步列出的六个文件，通过 1Panel 文件管理上传至网站根目录。测试截图、源码仓库元数据、验收文档和部署脚本无需放进公开的网站目录。

## 8. 验收

1. 浏览器访问 `https://landlord.luminestella.top`，出现公寓现场，而不是 1Panel 默认页。
2. 打开浏览器开发者工具，确认五个 CSS/JS 资源均为 200 或 304，不存在 404。
3. 走通「维修箱 → 保险丝 → 配电箱 → 地垫 → 维修卡 → 检修面板 → 芯片 → 终端」。
4. 刷新后，已取得的道具和设备状态仍然保留。
5. 更新后若仍看到旧版，先检查响应缓存策略，再执行浏览器强制刷新。

本仓库的本地浏览器验收记录不等于 VPS 已部署。上线状态应以目标域名实际访问结果为准。
