# -*- coding: utf-8 -*-
"""生成《门外无人》游戏封面 1600x1200（4:3）——与游戏内同款矢量美术风格。"""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1600, 1200
SS = 2                      # 超采样倍率
CW, CH = W * SS, H * SS

FONT_DIR = 'C:/Windows/Fonts/'
F_TITLE = FONT_DIR + 'STSONG.TTF'
F_HEI = FONT_DIR + 'simhei.ttf'
F_YAHEI = FONT_DIR + 'msyh.ttc'
F_MONO = FONT_DIR + 'consola.ttf'

C_TOP, C_BOT = (11, 15, 17), (4, 6, 8)
C_WALL, C_CEIL = (26, 31, 33), (34, 40, 42)
C_FLOOR = (18, 21, 23)
C_DOOR, C_DOOR_ST = (34, 40, 42), (58, 66, 67)
C_DOOR_404 = (26, 35, 33)
C_RED, C_GREEN = (168, 35, 47), (111, 154, 134)
C_BONE, C_BONE_HI, C_MUTED = (200, 207, 205), (230, 235, 232), (102, 112, 111)
C_LAMP = (232, 239, 236)

BACK_L, BACK_R = 600.0, 1000.0
BACK_T, BACK_B = 540.0, 840.0
topL = lambda x: BACK_T * x / BACK_L
botL = lambda x: H - (H - BACK_B) * x / BACK_L
flip = lambda x, right: (W - x) if right else x
SLOTS = {'near': (30, 190), 'mid': (270, 380), 'far': (455, 530)}
DOORS = [('403', 'near', False), ('405', 'mid', False), ('404', 'near', True), ('406', 'mid', True)]


def S(v):
    return v * SS


def qp(pts):
    return [(S(x), S(y)) for x, y in pts]


def door_quad(x1, x2, right):
    y = lambda x: topL(x) + (botL(x) - topL(x)) * 0.22
    pts = [(x1, y(x1)), (x2, y(x2)), (x2, botL(x2)), (x1, botL(x1))]
    return [(flip(x, right), yy) for x, yy in pts]


def bezier(p0, p1, p2, n=70):
    out = []
    for i in range(n + 1):
        t = i / n
        out.append((
            (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
        ))
    return out


def vgrad(size, top, bot):
    w, h = size
    g = Image.new('RGB', (1, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        k = y / max(1, h - 1)
        d.point((0, y), (round(top[0] + (bot[0] - top[0]) * k),
                         round(top[1] + (bot[1] - top[1]) * k),
                         round(top[2] + (bot[2] - top[2]) * k)))
    return g.resize((w, h), Image.BILINEAR)


def glow(size, center, radius, color, strength):
    w, h = size
    sw, sh = w // 16, h // 16
    layer = Image.new('L', (sw, sh), 0)
    d = ImageDraw.Draw(layer)
    cx, cy, r = center[0] / 16, center[1] / 16, radius / 16
    steps = 30
    for i in range(steps, 0, -1):
        k = i / steps
        d.ellipse([cx - r * k, cy - r * k, cx + r * k, cy + r * k], fill=int(255 * (1 - k) ** 1.7))
    layer = layer.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(w / 110))
    out = Image.new('RGBA', (w, h), color + (0,))
    out.putalpha(layer.point(lambda v: int(v * strength)))
    return out


def build_art():
    base = vgrad((CW, CH), C_TOP, C_BOT).convert('RGBA')
    d = ImageDraw.Draw(base)

    # 走廊四壁
    d.polygon(qp([(0, 0), (BACK_L, BACK_T), (BACK_L, BACK_B), (0, H)]), fill=C_WALL)
    d.polygon(qp([(W, 0), (BACK_R, BACK_T), (BACK_R, BACK_B), (W, H)]), fill=C_WALL)
    d.polygon(qp([(0, H), (BACK_L, BACK_B), (BACK_R, BACK_B), (W, H)]), fill=C_FLOOR)
    d.polygon(qp([(0, 0), (BACK_L, BACK_T), (BACK_R, BACK_T), (W, 0)]), fill=C_CEIL)
    d.rectangle([S(BACK_L), S(BACK_T), S(BACK_R), S(BACK_B)], fill=(10, 14, 15))
    d.line(qp([(0, H), (BACK_L, BACK_B)]), fill=(38, 45, 46), width=int(S(1.4)))
    d.line(qp([(W, H), (BACK_R, BACK_B)]), fill=(38, 45, 46), width=int(S(1.4)))

    # 尽头那扇虚掩的门 + 渗出的红光
    d.rectangle([S(742), S(600), S(878), S(BACK_B)], fill=(20, 26, 27), outline=(44, 52, 53), width=int(S(1.2)))
    d.rectangle([S(866), S(602), S(874), S(BACK_B - 2)], fill=C_RED)

    # 地毯上的两道轮痕（朝 405 门口去）
    for off in (0, 13):
        pts = bezier((1300, 1075 + off), (880, 1058 + off), (392, 988 + off))
        d.line(qp(pts), fill=(88, 97, 97), width=int(S(3.0)), joint='curve')
        d.line(qp([(x, y + 3) for x, y in pts]), fill=(24, 28, 29), width=int(S(2.0)), joint='curve')

    # 两侧的门
    for room, slot, right in DOORS:
        x1, x2 = SLOTS[slot]
        q = door_quad(x1, x2, right)
        d.polygon(qp(q), fill=C_DOOR_404 if room == '404' else C_DOOR, outline=C_DOOR_ST)
        ledx = (q[1][0] - 3) if right else (q[1][0] + 3)
        ledy = (q[1][1] + q[2][1]) / 2
        col = C_RED if room != '404' else (74, 35, 28)
        r = 4 if slot == 'near' else 3
        d.ellipse([S(ledx - r), S(ledy - r), S(ledx + r), S(ledy + r)], fill=col)

    # 顶灯
    for y, wd, bright in [(70, 240, 0.34), (270, 150, 0.24), (420, 92, 0.17)]:
        d.rectangle([S(W / 2 - wd / 2), S(y), S(W / 2 + wd / 2), S(y + 9)],
                    fill=tuple(int(c * bright + 12) for c in C_LAMP))

    # 门口的红色反光洒在地面上
    refl = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    ImageDraw.Draw(refl).polygon(qp([(742, 840), (878, 840), (1010, 1120), (620, 1120)]),
                                 fill=C_RED + (46,))
    refl = refl.filter(ImageFilter.GaussianBlur(S(26)))
    base = Image.alpha_composite(base, refl)

    base = Image.alpha_composite(base, glow((CW, CH), (S(W / 2), S(120)), S(600), C_LAMP, 0.17))
    base = Image.alpha_composite(base, glow((CW, CH), (S(870), S(730)), S(380), C_RED, 0.38))
    # 顶灯在地面上投下的一小片光池
    base = Image.alpha_composite(base, glow((CW, CH), (S(W / 2), S(1040)), S(430), C_LAMP, 0.09))
    base = Image.alpha_composite(base, glow((CW, CH), (S(W / 2), S(BACK_T)), S(320), C_LAMP, 0.10))
    return base.resize((W, H), Image.LANCZOS).convert('RGB')


def post(art):
    # 暗角：中心保留、四角压黑
    sw, sh = 200, 150
    sm = Image.new('L', (sw, sh), 0)
    px = sm.load()
    for yy in range(sh):
        for xx in range(sw):
            dx, dy = (xx - sw / 2) / (sw / 2), (yy - sh / 2) / (sh / 2)
            r = min(1.0, math.hypot(dx, dy) / 1.12)
            px[xx, yy] = int(255 * (1 - 0.66 * r ** 1.7))
    vig = sm.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(24))
    art = Image.composite(art, Image.new('RGB', (W, H), (0, 0, 0)), vig)

    noise = Image.effect_noise((W, H), 13).convert('L')
    art = Image.blend(art, Image.merge('RGB', (noise, noise, noise)), 0.042)
    return art


def tracked(d, xy, text, font, fill, tracking=0):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


def tracked_w(font, text, tracking=0):
    return sum(font.getlength(c) for c in text) + tracking * max(0, len(text) - 1)


def compose(art, with_text=True):
    img = art.copy()
    if not with_text:
        return img

    # 顶部压暗（标题区），底部轻微压暗（页脚区）
    m = Image.new('L', (1, H), 0)
    md = ImageDraw.Draw(m)
    for y in range(H):
        top = 250 * max(0.0, 1 - y / 620) ** 1.1
        bot = 130 * max(0.0, (y - 1030) / (H - 1030)) ** 1.2
        md.point((0, y), int(min(250, top + bot)))
    mask = m.resize((W, H), Image.BILINEAR)
    img = Image.composite(Image.new('RGB', (W, H), (3, 5, 6)), img, mask)

    d = ImageDraw.Draw(img)
    X = 132
    f_small = ImageFont.truetype(F_YAHEI, 27)
    f_title = ImageFont.truetype(F_TITLE, 172)
    f_sub = ImageFont.truetype(F_HEI, 37)
    f_hook = ImageFont.truetype(F_YAHEI, 29)
    f_mono = ImageFont.truetype(F_MONO, 23)
    f_foot = ImageFont.truetype(F_YAHEI, 22)

    # 顶部系列标签
    tracked(d, (X, 74), 'HOME-AI 404', f_mono, (86, 96, 95), 6)
    tracked(d, (X, 112), 'AI 房东 · 404号公寓', f_small, (146, 156, 154), 3)

    # 主标题（左上，压在压暗的天花板上）
    tracked(d, (X + 5, 176 + 5), '门外无人', f_title, (0, 0, 0), 26)
    tracked(d, (X, 176), '门外无人', f_title, C_BONE_HI, 26)

    # 血红细线 + 副标题 + 钩子
    d.rectangle([X, 398, X + 172, 403], fill=C_RED)
    tracked(d, (X, 428), '第一夜 · 谁在敲门', f_sub, C_BONE, 6)
    tracked(d, (X, 486), '门禁显示，过去半小时没有人进过这栋楼。', f_hook, (152, 162, 160), 1)

    # 页脚
    tracked(d, (X, 1146), '第一视角监控 · 0.8 秒回放对比 · 线索连线推理', f_foot, (108, 118, 117), 1)
    tail = '第一章 DEMO'
    tracked(d, (W - X - tracked_w(f_foot, tail, 2), 1146), tail, f_foot, (86, 96, 95), 2)
    return img


if __name__ == '__main__':
    art = post(build_art())
    art.save('cover-raw.png')
    compose(art, True).save('cover.png')
    print('saved cover.png / cover-raw.png', W, 'x', H)
