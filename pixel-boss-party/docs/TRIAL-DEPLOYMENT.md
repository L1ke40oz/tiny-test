# OpenResty + Cloudflare 试运行部署

更新：2026-10-22（Asia/Singapore）。此流程在已有 1Panel / OpenResty 的 Ubuntu 主机上新增独立游戏服务，不替换已有应用。

## 已核实与试运行边界

用户确认 VPS 为 x86_64，已安装 Docker 与 Compose，可访问 GitHub，有足够的当前可用内存和磁盘。OpenResty 容器使用 host 网络，因此能访问宿主 `127.0.0.1:3030`。已有别的应用占用 3000，游戏不使用该宿主端口。

```text
浏览器 → HTTPS tools.luminestella.top → Cloudflare 代理
       → 现有 OpenResty → 宿主 127.0.0.1:3030 → 游戏容器 3000
```

本次不需要 Cloudflare Tunnel 或 Token，也不需要更改目前已代理的 A 记录。游戏端口只发布到宿主回环地址，不添加公网 3030 入口。该方案让正常玩家连接 Cloudflare，但不能消除既有 IP 历史记录。

这是联网试运行版：已有单房主账号、密码哈希、签名 HttpOnly Cookie、登录限流、来源校验和房间权限。房间、登录会话和成绩仍在内存中，重启服务将清空，持久化战绩后续实现。

## 1. 下载源码

在 1Panel 的宿主终端执行。若目标目录已存在，不覆盖它，先检查是否为之前的同一项目。

```bash
cd /opt
git clone --branch main --single-branch https://github.com/L1ke40oz/pixel-boss-party.git
cd /opt/pixel-boss-party
```

如果缺少 git，停止并报告错误，使用归档下载替代；无需为了这个项目重装面板或 Docker。

## 2. 只在服务器设置账号

```bash
python3 deploy/setup.py
```

- 网站地址默认 `https://tools.luminestella.top`；需与实际访问域名一致。
- 房主账号默认 `host`。
- 输入 12–128 字符密码并确认，输入不会回显；直接回车可自动生成密码，生成值仅在本机显示一次，请自行保存。
- 脚本生成 `.env` 与 `.secrets/`，均不提交 Git。它不会覆盖已有配置。
- 密码只存 scrypt 哈希；会话密钥独立随机生成。secret 目录权限为 0700，单个挂载文件为只读，让非 root 容器能够读取。

不要把密码、会话密钥或 `.secrets` 内容发到聊天。此流程不询问 Tunnel Token。

## 3. 构建、启动并检查本机

```bash
docker compose config --quiet
docker compose up -d --build app
docker compose ps
curl -fsS http://127.0.0.1:3030/api/health
```

健康响应应包含 `"ok":true` 与 `"mode":"public-trial"`。镜像构建分前后端构建与运行阶段，运行阶段只保留生产依赖和构建产物，以非 root 用户运行，容器根文件系统只读，日志轮转并限制应用容器内存。

本地开发环境没有 Docker 引擎，因此镜像构建和容器健康状态以本步骤在 VPS 上的结果为准；不能只凭本地 Node 构建通过就认定容器已启动。

3030 若已被占用，先改 `.env` 的 `APP_PORT`，同步修改后续 OpenResty 目标；不要停止不相关服务。

排错只需：

```bash
docker compose ps
docker compose logs --tail=80 app
```

## 4. 在现有 OpenResty 站点设置反向代理

先备份 `tools.luminestella.top` 站点原配置，保留证书、其他域名与现有站点。

在 1Panel 的网站管理中找到该域名，设置根路径 `/` 的反向代理，目标为：

```text
http://127.0.0.1:3030
```

启用 WebSocket 支持；若面板没有单独开关，检查生成的代理配置包含：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 300s;
```

完整根 location 参考 `deploy/openresty-location.conf.example`。替换本站已有根 location，不能重复添加两段 `location /`。不要覆盖全局 OpenResty 配置或已有 1Panel 管理域名。

保留 HTTPS；Cloudflare DNS 记录维持橙云代理。已有 SSL 模式与源站证书先核对再调整，使用有效源站证书时可使用 Full (strict)，不为游戏关闭现有 TLS 验证。

## 5. 公网验证

1. 打开 `https://tools.luminestella.top/api/health`，确认响应来自游戏，而不是 Nginx 默认页。
2. 首页右上角登录房主账号，填写游戏昵称后创建房间。
3. 用独立手机或无痕窗口扫码加入，不需要房主账号。
4. 至少两端答题，确认提前结算、扣血、榜单和断线恢复；检查 WebSocket 可升级。
5. 再邀请 5–6 人试玩；分别用 Wi-Fi 和移动网络测试。域名首页能打开不代表跨境联机已经验证通过。

原始答案、服务器秘密和源站地址不得出现在前端资源或未结算题目的响应中。普通账号与未登录访客不能通过直接发送消息创建房间或调用房主管理操作。

## 6. 更新、停止与回退

更新前记录 `git rev-parse HEAD` 和镜像 ID，备份 `.env`、`.secrets` 以及站点原配置。

```bash
git pull --ff-only
docker compose up -d --build app
```

这会重启游戏、清空当前内存对局与登录会话，选择无人游戏时更新。

```bash
docker compose down
```

停止只影响本 Compose 项目，不执行删除卷或全局 Docker 清理。回退时恢复先前代码/镜像以及本站原反代配置；不要动其他服务、域名或防火墙规则。

## 官方参考

- [Socket.IO：反向代理与 WebSocket 配置](https://socket.io/docs/v4/reverse-proxy/)
- [1Panel：网站基础配置](https://1panel.pro/docs/v2/user_manual/websites/website_config_basic/)
- [Cloudflare：WebSocket 支持](https://developers.cloudflare.com/network/websockets/)
