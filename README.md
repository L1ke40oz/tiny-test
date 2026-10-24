# 找颜色 · Color Hunt（手机浏览器 Demo）

验证一个玩法问题：**玩家能不能用手机摄像头，在现实环境中快速找到系统指定的颜色，并获得即时反馈？**

纯 HTML + CSS + JavaScript，无框架、无后端、无 AI 模型，只用浏览器原生 API。

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构：开始页、摄像头画面、HUD、取景框、结果弹层 |
| `style.css` | 竖屏优先的小游戏风格样式 |
| `app.js` | 摄像头、抽帧取色、RGB→HSV、匹配判定、倒计时、关卡流程（注释详细） |
| `README.md` | 本文档 |

## 玩法

1. 点击“开始挑战”，允许使用摄像头（默认后置）。
2. 顶部显示目标颜色（红 / 橙 / 黄 / 绿 / 蓝）和 10 秒倒计时。
3. 把目标颜色放进中央的虚线圈里，匹配度超过过关线并**持续约 0.5 秒**即成功（外圈进度环会走满）。
4. 成功：屏幕闪绿光 + 震动（支持的设备）+ “挑战成功”，点“下一关”换新颜色。
5. 超时：显示“时间到”，可以“重新挑战”同一颜色或“换个颜色”。

## ⚠️ 必须使用 HTTPS

浏览器只允许在**安全上下文**中调用摄像头（`navigator.mediaDevices.getUserMedia`）：

- ✅ `https://你的域名/`
- ✅ `http://localhost` / `http://127.0.0.1`（仅限本机电脑调试）
- ❌ `http://192.168.x.x` 或 `http://公网IP` —— 手机上会直接提示“不是 HTTPS”，无法使用摄像头

所以**手机测试必须部署到 HTTPS 地址**。

## 本地电脑调试

```bash
cd color-hunt
python -m http.server 8000
# 浏览器打开 http://localhost:8000 （电脑摄像头即可测试流程）
```

> 直接双击 `index.html`（`file://`）在部分浏览器中无法使用摄像头，请用本地服务器。

## 部署到 VPS（OpenResty + Let's Encrypt）

前提：
- VPS 已安装 OpenResty（官方源安装，路径 `/usr/local/openresty`，服务名 `openresty`）；
- 有一个域名（下文用 `game.example.com`），A 记录已指向 VPS 公网 IP；
- 云服务商安全组 / 防火墙放行 80、443 端口。

SSH 登录 VPS 后依次执行：

```bash
# ---- 0. 设置你的域名 ----
DOMAIN=game.example.com
OR=/usr/local/openresty/nginx

# ---- 1. 拉取代码 ----
apt update && apt install -y git certbot
git clone https://github.com/L1ke40oz/color-hunt.git /var/www/color-hunt

# ---- 2. 让 OpenResty 加载 conf.d/*.conf（已有则跳过）----
mkdir -p $OR/conf/conf.d
grep -q 'conf.d/\*.conf' $OR/conf/nginx.conf || sed -i '/^http {/a\    include conf.d/*.conf;' $OR/conf/nginx.conf

# ---- 3. 先用 HTTP 配置，供证书验证 ----
cat > $OR/conf/conf.d/color-hunt.conf <<'EOF'
server {
    listen 80;
    server_name __DOMAIN__;
    root /var/www/color-hunt;
    location / { try_files $uri $uri/ =404; }
}
EOF
sed -i "s/__DOMAIN__/$DOMAIN/g" $OR/conf/conf.d/color-hunt.conf
openresty -t && systemctl reload openresty

# ---- 4. 申请证书（webroot 方式，不改动 OpenResty 配置）----
certbot certonly --webroot -w /var/www/color-hunt -d $DOMAIN   --agree-tos -m 你的邮箱 --no-eff-email   --deploy-hook "systemctl reload openresty"

# ---- 5. 换成 HTTPS 配置（HTTP 自动跳转 HTTPS）----
cat > $OR/conf/conf.d/color-hunt.conf <<'EOF'
server {
    listen 80;
    server_name __DOMAIN__;
    location /.well-known/acme-challenge/ { root /var/www/color-hunt; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name __DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /var/www/color-hunt;
    index index.html;

    # 禁止访问 .git 等隐藏目录（站点目录是 git 仓库）
    location ~ /\.(?!well-known) { deny all; }

    location / { try_files $uri $uri/ =404; }
}
EOF
sed -i "s/__DOMAIN__/$DOMAIN/g" $OR/conf/conf.d/color-hunt.conf
openresty -t && systemctl reload openresty

# ---- 6. 验证 ----
curl -I https://$DOMAIN                       # 应返回 200
curl -I https://$DOMAIN/.git/config           # 应返回 403
certbot renew --dry-run                       # 自动续期演练
```

完成后手机打开 `https://game.example.com` 即可。

**更新代码：**

```bash
cd /var/www/color-hunt && git pull
```

静态文件无需重启 OpenResty；手机端如看到旧版本，刷新或清缓存。

> 如果你的 OpenResty 是 **1Panel** 等面板以容器方式安装的，上面的路径不适用：在面板中“网站 → 创建 → 静态网站”，把仓库文件放到站点目录，再在面板里申请并开启 HTTPS 即可。

## 颜色判定设计（概要）

- 每 100ms 用 `canvas.drawImage(video, ...)` 截取取景框中心区域（直径 60%，即虚线圈），缩小到 32×32 后求圆形区域内的平均 RGB。
- RGB 转 HSV，**主要比较色相 H**（受光照影响最小），饱和度 S、明度 V 只设宽松下限，排除灰白和过暗。
- 匹配度 = 色相得分 × 饱和度系数 × 明度系数，≥ 60% 视为接近；连续接近 500ms 判定成功，中途允许 ~150ms 抖动。
- 调参全部集中在 `app.js` 顶部的 `CONFIG` 和 `TARGETS`。觉得太严/太松，优先调 `hueCore`（满分范围）和 `MATCH_THRESHOLD`。

## 为什么不用 AI / 多模态模型

本玩法判断的是“颜色”而不是“物体”。像素本身就是 RGB 数值，平均 + HSV 比较几十行代码就能得到确定、可解释、毫秒级的结果；无需联网、无需下载模型、低端机也流畅，画面也不会离开设备。

## 兼容性与已知限制

- 支持：iOS Safari 14.3+、Android Chrome、主流国产浏览器。部分 App 内置浏览器（如某些版本的微信、QQ）可能不允许调用摄像头，请“在浏览器中打开”。
- iOS 不支持 `navigator.vibrate`，成功时不会震动（代码已静默处理，不会报错）。
- 摄像头的自动白平衡 / 自动曝光会影响颜色，强逆光、昏暗环境、暖色灯下识别会变差，这属于玩法验证中要观察的现象。
- 没有摄像头 / 拒绝权限 / 浏览器不支持 / 摄像头被占用，都会在开始页给出中文提示。
