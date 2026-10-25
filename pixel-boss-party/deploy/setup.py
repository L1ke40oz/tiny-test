#!/usr/bin/env python3
"""在 VPS 本机生成 OpenResty 试运行配置；不把密码放进命令行。"""
import getpass
import hashlib
import os
from pathlib import Path
import re
import secrets
from urllib.parse import urlsplit


def main():
    root = Path(__file__).resolve().parent.parent
    os.umask(0o077)
    target = root / '.secrets'
    if (root / '.env').exists() or target.exists():
        raise SystemExit('已有部署配置，未覆盖。需要改配置时先备份 .env 和 .secrets，再单独调整。')
    origin = input('网站地址 [https://tools.luminestella.top]：').strip() or 'https://tools.luminestella.top'
    parsed = urlsplit(origin)
    if parsed.scheme != 'https' or not parsed.hostname or not re.fullmatch(r'[A-Za-z0-9.-]+', parsed.hostname) or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise SystemExit('请填写不带路径的 HTTPS 域名地址。')
    origin = f'https://{parsed.netloc}'
    username = input('房主账号 [host]：').strip() or 'host'
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', username):
        raise SystemExit('账号限 1–64 位字母、数字、下划线或短横线。')
    password = getpass.getpass('设置房主密码（至少12位；直接回车自动生成）：')
    generated = not password
    if generated:
        password = secrets.token_urlsafe(18)
    elif len(password) < 12 or len(password) > 128:
        raise SystemExit('密码需为 12–128 个字符。')
    elif getpass.getpass('再次输入密码：') != password:
        raise SystemExit('两次密码不一致，未写入配置。')
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode('utf8'), salt=salt, n=16384, r=8, p=1, dklen=64)
    target.mkdir(mode=0o700)
    for name, value in {
        'host-password-hash': f'scrypt${salt.hex()}${key.hex()}',
        'session-secret': secrets.token_hex(32),
    }.items():
        path = target / name
        path.write_text(value + '\n', encoding='utf8')
        # Compose 把单个文件挂进容器；目录 0700 保护宿主访问，文件只读供非 root 容器使用。
        path.chmod(0o444)
    (root / '.env').write_text(f'PUBLIC_ORIGIN={origin}\nHOST_USERNAME={username}\nAPP_PORT=3030\n', encoding='utf8')
    print(f'配置完成。房主账号：{username}')
    if generated:
        print(f'自动生成的房主密码（请自行保存，不要发到聊天）：{password}')
    print('部署配置已留在本机，不会提交 Git。')
    print('下一步：docker compose up -d --build app')
    print('本机健康后，再在 OpenResty 将网站代理到 http://127.0.0.1:3030；无需 Tunnel Token。')


if __name__ == '__main__':
    main()
