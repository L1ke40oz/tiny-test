# 部署与远程管理方案

更新：2026-10-22。**本次已选择沿用 OpenResty + Cloudflare 代理，实际执行请看 [试运行步骤](TRIAL-DEPLOYMENT.md)。** 已通过用户的 1Panel 终端输出核实 Docker、Compose、资源与 OpenResty host 网络；3389 可达但国内 Windows 的 22 未开放，本机连接美国 VPS 的 SSH 超时。用户将在 1Panel 宿主终端执行部署。以下保留早期方案供架构参考，Tunnel 并非本次部署依赖。游戏尚未在 VPS 启动，未修改网站反代或 DNS。

## 1. 已知环境

- 目标：美国 Ubuntu VPS，用户已安装 1Panel，可通过配置的域名访问面板，服务商提供 VNC。
- 用户当前网络不能直接 SSH 到美国 VPS。
- 用户已有国内 Windows 云服务器，并于本次讨论中确认：从这台 Windows 服务器 SSH 到美国 VPS 成功。
- 国内服务器的入口端口“应该是 3389”，用户名 Administrator。该端口尚未验证。
- 美国 VPS 的 SSH 端口 22，用户名 ubuntu；认证方式与 sudo 权限尚未确认。
- 目标网站：`https://tools.luminestella.top`；用户已添加 Cloudflare A 记录，指向、代理开关、是否占用旧服务均未检查。
- 真实 IP 与连接信息仅记在 `../local/INFRASTRUCTURE.md`。

## 2. Windows 跳转需要澄清的地方

3389 是 Windows 远程桌面 RDP 的默认端口，不是已确认的 SSH 端口。Windows 能向美国 VPS 发起 SSH，不能证明它自身运行着可从本机访问的 SSH 服务。

因此现在不能直接写一个 `ssh -J ...:3389 ...` 就认定可用。需要确认 Windows 的管理入口以及是否安装、启用了 OpenSSH Server。

### 路径 A：Windows OpenSSH 跳板

前提：Windows 开启 OpenSSH Server、本机能连接其 SSH 端口、允许所需的 TCP 转发，且目标 VPS 的认证可用。

验证顺序：

1. 用户通过现有 RDP 登录 Windows，检查 `Get-Service sshd`，确认 SSH 服务与实际监听端口。
2. 核对 Windows 防火墙、云安全组和允许访问的来源。
3. 设置专用部署公钥；Windows 管理员账号的 authorized_keys 位置可能受系统 sshd 配置影响，应按实际配置和 ACL 设置，不照搬 Linux 路径。
4. 本机先验证到 Windows 的 SSH，再验证通过 `ProxyJump` 到 Ubuntu。
5. 首次连接通过可信控制台核对主机指纹；不关闭主机密钥校验，不启用代理转发来代替正常认证。

登录端口、密钥和别名明确后，再生成实际 SSH 配置。不要把 RDP 密码、现有 SSH 私钥粘贴到聊天或文档。

### 路径 B：由用户在 Windows / VNC 中执行部署

不为跳板额外开启服务。助手提供已检查的源码、Compose 和命令，用户通过当前可用的 Windows → Ubuntu SSH 执行；VNC 保留作恢复入口。这条路径已经有用户验证过的服务器间连通性。

### 路径 C：Cloudflare Tunnel + Access SSH

用户通过现有终端或 VNC 在 VPS 安装 cloudflared，配置单独的 SSH 访问域名与 Access 策略，本机使用 cloudflared 作为 SSH 代理。需要完成访问策略、认证和 Ubuntu 公钥配置。

游戏公开域名与管理入口分开；不要把需要登录的 Access 策略直接套在所有游客游戏请求上。

## 3. 玩家访问与 DNS

优先评估：

```text
大陆手机浏览器 → tools.luminestella.top / Cloudflare
              → Tunnel → VPS 本地应用端口
```

Tunnel 由 VPS 主动建立出站连接，无需为游戏开放公网源站端口。cloudflared 要能连接 Cloudflare 的 7844 端口，具体 TCP/UDP 取决于使用的传输协议。大陆玩家体验以实测为准，不把 Cloudflare 当作延迟保证。

### 当前 A 记录如何处理

- “添加了一条 A 记录”不等于 Tunnel 已配置好，也不能据此认定源站已隐藏。
- 若选 Tunnel，应把该主机名路由到 Tunnel。官方流程通常生成指向 `<Tunnel UUID>.cfargotunnel.com` 的 DNS 记录；同名现有 A 记录可能冲突，调整前先记录原值和用途。
- 若选普通 Cloudflare 代理 A 记录，应确认代理开启、源站 TLS 与访问限制。它与 Tunnel 是两种不同接入方式，不能混为一谈。
- 不自动删除或修改现有 DNS；实施时检查当前配置、确认没有复用服务，再做对应变更并记录回滚值。
- 源站曾出现在 DNS 历史或其他服务中，隧道不能消除已有公开记录。目标是游戏正常访问不暴露源站地址，并阻止绕过接入层直接访问应用。

## 4. 应用部署形态

建议游戏单独使用 Compose 项目，独立服务名、网络、目录和数据卷，避免影响已有 1Panel 站点。

- `app`：提供网页、API 和 Socket.IO；持久化 SQLite 与必要数据。
- `cloudflared`：可放入同一 Compose 网络，访问 `http://app:<应用端口>`；Token 通过环境或密钥文件注入。
- 若 cloudflared 运行在宿主机，应用端口只绑定宿主 `127.0.0.1`。若它运行在容器内，`localhost` 指容器自己，应通过 Docker 网络访问 app，不能误指向宿主应用。
- 同实例监听网页与 Socket.IO，配置健康检查、自动重启和受控日志大小。
- 应用以非 root 身份运行；部署账号的 Docker 权限与 sudo 能力根据实际情况核对。
- 配置 `PUBLIC_ORIGIN`、会话密钥、房主初始化凭据、数据库路径；不把真实值写入镜像或 Git。
- 检查 Cloudflare 缓存规则不会缓存动态 API、登录响应、房间状态和 Socket.IO 握手；静态资源按内容哈希缓存。

## 5. 实施顺序与恢复

1. 只读盘点：Ubuntu 版本、CPU/内存/磁盘、Docker/Compose、已有监听端口、1Panel 管理范围、备份情况。
2. 确认可持续的管理入口，保留 VNC，不在尚未验证新入口时关闭旧入口或改防火墙。
3. 先在本地完成游戏闭环，再上传构建或拉取可追溯版本，在独立目录启动。
4. 检查本地健康端点、数据库写入、日志和容器重启行为。
5. 建立隧道或配置现有代理；核对 DNS 原值并记录变更。
6. 大陆手机经域名验证扫码、六人答题、断线恢复、房主操作与长连接。
7. 验证网页与网络请求无源站地址、原始答题数据无答案，且应用没有额外公网旁路。
8. 备份 SQLite 与部署配置。数据库使用在线备份机制，或停止写入后复制；不要只在 WAL 写入中复制主数据库文件。
9. 发布失败则恢复上一镜像与配置；若涉及数据结构变更，使用事先验证的数据库备份恢复路径。DNS 恢复到记录的旧值，避免影响其他站点。

实际服务器规格与网络质量未测，暂不承诺资源余量、延迟或稳定性。

## 6. 官方参考

- [Microsoft：远程桌面默认监听 3389](https://learn.microsoft.com/en-us/windows-server/remote/remote-desktop-services/remotepc/change-listening-port)
- [OpenSSH：ssh 与 ProxyJump](https://man.openbsd.org/ssh)
- [Cloudflare Tunnel 工作方式](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Cloudflare Tunnel 出站网络要求](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/)
- [Cloudflare Tunnel DNS 路由](https://developers.cloudflare.com/tunnel/concepts/routing/)
- [通过 cloudflared 连接 SSH](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-cloudflared-authentication/)
