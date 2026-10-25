# 像素讨伐队 · Pixel Boss Party

供 5–6 人通过手机网页实时合作答题、击败 Boss 的小游戏。

**当前阶段：v0.1 已加入房主登录和联网试运行部署配置，尚待 VPS 实际构建与公网联调。当前采用零血量淘汰制，完整进度和限制见 [STATUS.md](docs/STATUS.md)。**

更新日期：2026-10-22（Asia/Shanghai）。

## 本地试玩

需要 Node.js 22.12 或更新的受支持版本。Windows 可以双击 `开始试玩.cmd`，启动后打开 <http://127.0.0.1:3000>。

开发时：

```powershell
npm.cmd ci
npm.cmd run dev
```

浏览器打开 <http://127.0.0.1:5173>。先填写昵称创建房间，再用浏览器新建独立标签页打开同一网址，填写另一个昵称和房间码加入。刷新保留身份；“复制标签页”可能克隆 sessionStorage，从而接管原来的身份。

预构建试玩：`npm.cmd run build`，然后 `npm.cmd start`，打开 <http://127.0.0.1:3000>。关闭启动终端或按 Ctrl+C 停止服务。

本地默认无需账号；公网试运行必须配置房主密码与会话密钥。房间、登录会话和成绩在内存中，服务重启后清空。本机二维码指向本机地址；部署到域名后再验证手机扫码。

## VPS 试运行

按 [OpenResty + Cloudflare 部署步骤](docs/TRIAL-DEPLOYMENT.md) 操作：在服务器生成账号配置，使用 Docker Compose 构建，再由现有 OpenResty 转发到回环地址 3030。无需 Tunnel Token。密码与密钥只留在服务器，不提交到仓库。

## 验证

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

测试包括 6 个真实 Socket.IO 客户端的联机流程。`server/` 保存答案和权威游戏状态，`shared/` 保存公开协议类型，`src/` 是 React 界面，`tests/` 是关键规则与通信测试。

## 从这里继续

1. 阅读 [开发文档](docs/DEVELOPMENT.md)：需求、玩法、页面、技术架构、通信和验收。
2. 阅读 [部署方案](docs/DEPLOYMENT.md)：美国 Ubuntu VPS、Windows 管理入口、Cloudflare 与发布步骤。
3. 阅读 [当前进度](docs/STATUS.md)：已完成事项、未决问题、下一步。
4. 需要连接服务器时，再阅读本地的 `local/INFRASTRUCTURE.md`。该文件包含真实基础设施地址，已加入 Git 忽略规则。

## 已确认的核心方向

- 玩家主要在中国大陆，通过二维码访问 `https://tools.luminestella.top`。
- 像素风；房主账号创建房间，玩家以昵称加入。
- 全员同时回答同一道题，每题限时；全员提交后提前结算。
- 答对伤害 Boss，答错损失自身血量，实时展示贡献排行榜。
- 血量归零后本局只能旁观，剩余玩家继续答题；全队倒下失败，下一局恢复满血。
- 房主可以观战或参与，并查看房内游戏操作。
- 部署目标是已有美国 Ubuntu VPS；普通玩家访问时不直接连接源站 IP。

除上述已确认方向外，文档中的具体数值和技术实现均为初版建议，可在开发和试玩中调整。
