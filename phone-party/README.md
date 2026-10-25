# 整活派对 · Phone Party

大屏幕当舞台，每个人的手机当手柄，AI 毒舌主持人现场点评。灵感来自《马里奥派对》《瓦力欧制造》：每关几秒钟，操作方式各不相同，全场一起笑。

- **扫码即玩**：不用装 App，最多 8 人一个房间
- **手机就是手柄**：陀螺仪、加速度计、摄像头、麦克风轮番上阵
- **AI 主持人**：每关结束根据成绩和“派对记忆”翻旧账吐槽，大屏语音朗读
- **演示不翻车**：AI 只在结算过场里工作；没配 Key、超时或断网时自动换成内置台词

## 微游戏

| 游戏 | 操作 | 判定 |
| --- | --- | --- |
| 倒！倒沙子 | 陀螺仪：侧倾倒出沙子，扶正让沙落进杯子 | 杯中沙量 ≥ 45% |
| 找！找颜色 | 摄像头：对准指定颜色稳住 0.4 秒 | HSV 色相匹配 |
| 摇！摇可乐 | 加速度计：疯狂摇晃 | 摇满 24 下 |
| 端平！端水大师 | 陀螺仪：放平手机，抵抗会转向的风 | 水珠在圈内时间 ≥ 55% |
| 吹！吹蜡烛 | 麦克风：对着手机吹气 | 累计吹气吹灭 3 根蜡烛 |

每局随机 5 关。名次规则：成功优先 → 得分高优先 → 用时短优先，按名次给 5/4/3/2/1 分。

## 架构

```
大屏 /host ──┐
             ├── WebSocket /ws ── Node 服务端（房间 + 回合状态机 + AI 主持）
手机 /  ×8 ──┘
```

- **游戏在手机本地运行和判定**，只上报进度和结果，服务器负担很小（低配 VPS 足够）
- 服务端统一下发关卡参数（同一个目标颜色、同一侧的杯子），保证公平
- 手机断线后可自动重连，保留分数

```
server/
  index.js    HTTP 静态文件 + WebSocket 入口
  rooms.js    房间与回合状态机、计分、派对记忆
  games.js    微游戏目录与关卡参数
  ai.js       AI 主持人（Claude API）+ 内置台词兜底
public/
  index.html  手机端        host.html  大屏端
  js/sensors.js  传感器封装（陀螺仪 / 摇晃 / 摄像头 / 麦克风 + 鼠标键盘备用输入）
  js/games/*.js  各个微游戏
```

### 新增一个微游戏

1. 在 `public/js/games/` 新建模块，导出 `create(stage, ctx)`，返回 `{ end(), destroy() }`（接口说明见 `games/util.js`）
2. 在 `public/js/phone.js` 的 `GAMES` 中注册
3. 在 `server/games.js` 的 `GAMES` 中加上标题、动词、时长和参数

## 本地开发

需要 Node.js 18+。

```bash
npm install
cp .env.example .env     # 可选：填入 ANTHROPIC_API_KEY
npm run dev              # 修改服务端代码自动重启
```

- 大屏：http://localhost:3000/host
- 手机端：在电脑上多开几个标签页打开 http://localhost:3000/?room=房间号 即可模拟多人
- 电脑没有陀螺仪时的备用操作：**按住拖动 = 倾斜，点击/空格 = 摇晃，方向键 = 倾斜**；没有麦克风时按住 = 吹气

> ⚠️ 手机上的陀螺仪、摄像头、麦克风都**只能在 HTTPS 下使用**，真机测试请部署到带证书的域名。

## 部署到 VPS（OpenResty 反代 + systemd）

前提：VPS 已装 OpenResty（`/usr/local/openresty`），有一个解析到 VPS 的域名，放行 80/443。

```bash
# ---- 0. 变量 ----
DOMAIN=party.example.com
OR=/usr/local/openresty/nginx

# ---- 1. 安装 Node.js 20 ----
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git certbot

# ---- 2. 拉代码、装依赖、配置 ----
git clone <你的仓库地址> /opt/phone-party
cd /opt/phone-party
npm ci --omit=dev
cp .env.example .env
nano .env                      # 填 ANTHROPIC_API_KEY（可不填）
chmod 600 .env                 # Key 只允许 root 读，由 systemd 注入环境变量

# ---- 3. systemd 守护进程 ----
cat > /etc/systemd/system/phone-party.service <<'EOF'
[Unit]
Description=Phone Party game server
After=network.target

[Service]
WorkingDirectory=/opt/phone-party
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=2
EnvironmentFile=/opt/phone-party/.env
User=nobody
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now phone-party
curl -s http://127.0.0.1:3000/healthz      # 应返回 {"ok":true,...}

# ---- 4. OpenResty：先上 HTTP，用于申请证书 ----
mkdir -p $OR/conf/conf.d /var/www/acme
grep -q 'conf.d/\*.conf' $OR/conf/nginx.conf || sed -i '/^http {/a\    include conf.d/*.conf;' $OR/conf/nginx.conf
cat > $OR/conf/conf.d/phone-party.conf <<'EOF'
server {
    listen 80;
    server_name __DOMAIN__;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 404; }
}
EOF
sed -i "s/__DOMAIN__/$DOMAIN/g" $OR/conf/conf.d/phone-party.conf
openresty -t && systemctl reload openresty

certbot certonly --webroot -w /var/www/acme -d $DOMAIN \
  --agree-tos -m 你的邮箱 --no-eff-email \
  --deploy-hook "systemctl reload openresty"

# ---- 5. 正式配置：HTTPS + WebSocket 反代 ----
cat > $OR/conf/conf.d/phone-party.conf <<'EOF'
server {
    listen 80;
    server_name __DOMAIN__;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name __DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket 升级
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF
sed -i "s/__DOMAIN__/$DOMAIN/g" $OR/conf/conf.d/phone-party.conf
openresty -t && systemctl reload openresty
```

完成后：电脑浏览器打开 `https://party.example.com/host` 当大屏，手机扫码加入。

**更新代码：**

```bash
cd /opt/phone-party && git pull && npm ci --omit=dev && systemctl restart phone-party
```

**查看日志：** `journalctl -u phone-party -f`

### 关于 AI 能否连通

服务器需要能访问 `api.anthropic.com`。如果 VPS 所在网络访问不了，AI 会在超时后自动使用内置台词，游戏不受影响；可以在启动日志 / `curl 127.0.0.1:3000/healthz` 里看到 AI 状态。

## 演示小贴士

- 大屏点“创建房间”时会开启语音，**提前把电脑声音打开**
- 大屏刷新不会丢房间（会自动恢复），手机锁屏回来会自动重连
- 现场网络不稳时可在 `.env` 设 `AI_DISABLED=1`，用内置台词兜底
