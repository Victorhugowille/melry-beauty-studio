# -*- coding: utf-8 -*-
"""
Gera o assets/loading.mp4 do Melry Beauty Studio.
Vídeo de splash: fundo rosé do site, logo circular flutuando com
anéis giratórios, varredura de brilho, brilhinhos e vinheta.

Uso: python tools/generate-loading-video.py
Saída: assets/loading.mp4 (1280x720, 30fps, ~8s)
"""
import math
import random
import os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
FPS = 30
DURATION = 8.0
FRAMES = int(FPS * DURATION)
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "loading.mp4")
LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-256.png")

# Paleta (mesmos tons do CSS do site)
BG_TOP = np.array([250, 237, 235], np.float32)      # #fbedeb
BG_BOTTOM = np.array([243, 219, 216], np.float32)   # #f3dbd8
AURA = np.array([232, 190, 199], np.float32)        # #e8bec7
VINHETA = np.array([120, 59, 74], np.float32)       # #783b4a

random.seed(42)

# ----------------------------------------------------------------
# PRÉ-CALCULO: gradiente vertical + vinheta
# ----------------------------------------------------------------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
t = (yy / H)[:, :, None]
base = BG_TOP * (1 - t) + BG_BOTTOM * t  # (H, W, 3) float32

dx = (xx - W / 2) / (W * 0.72)
dy = (yy - H * 0.46) / (H * 0.72)
dist = np.sqrt(dx * dx + dy * dy)
vinheta = np.clip((dist - 0.62) / 0.62, 0, 1) ** 2.1
vinheta = (1 - vinheta * 0.24)[:, :, None]

# ----------------------------------------------------------------
# AURA radial atrás da logo (pulsa devagar)
# ----------------------------------------------------------------
aura_dx = (xx - W / 2) / (W * 0.30)
aura_dy = (yy - H * 0.42) / (H * 0.42)
aura_d = np.sqrt(aura_dx**2 + aura_dy**2)
aura_mask = np.clip(1 - aura_d, 0, 1) ** 2.2  # (H, W)

# ----------------------------------------------------------------
# LOGO circular com borda clara e máscara alfa
# ----------------------------------------------------------------
LOGO_D = 300
logo = Image.open(LOGO_PATH).convert("RGB")
# recorte quadrado central (o logo ja e quadrado)
side = min(logo.size)
logo = logo.crop(((logo.width - side) // 2, (logo.height - side) // 2,
                  (logo.width + side) // 2, (logo.height + side) // 2))
logo = logo.resize((LOGO_D, LOGO_D), Image.LANCZOS)

# máscara circular (anti-aliased: desenha em 4x e reduz)
S = 4
mask = Image.new("L", (LOGO_D * S, LOGO_D * S), 0)
md = ImageDraw.Draw(mask)
md.ellipse([0, 0, LOGO_D * S, LOGO_D * S], fill=255)
mask = mask.resize((LOGO_D, LOGO_D), Image.LANCZOS)

# borda branca do cartão
border_mask = Image.new("L", (LOGO_D * S, LOGO_D * S), 0)
md = ImageDraw.Draw(border_mask)
BORDER = 26  # px em 4x (~6.5px real)
md.ellipse([0, 0, LOGO_D * S, LOGO_D * S], fill=255)
md.ellipse([BORDER, BORDER, LOGO_D * S - BORDER, LOGO_D * S - BORDER], fill=0)
border_mask = border_mask.resize((LOGO_D, LOGO_D), Image.LANCZOS)

logo_rgba = logo.convert("RGBA")
logo_rgba.putalpha(mask)

border_img = Image.new("RGBA", (LOGO_D, LOGO_D), (250, 243, 241, 255))
border_img.putalpha(border_mask)

# sombra da logo (pré-render com blur)
shadow_pad = 60
logo_shadow = Image.new("RGBA", (LOGO_D + shadow_pad * 2, LOGO_D + shadow_pad * 2), (0, 0, 0, 0))
sd = Image.new("RGBA", (LOGO_D, LOGO_D), (70, 24, 33, 160))
sd.putalpha(mask.point(lambda p: int(p * 0.85)))
logo_shadow.paste(sd, (shadow_pad, shadow_pad + 8))
logo_shadow = logo_shadow.filter(ImageFilter.GaussianBlur(22))

logo_np = np.array(logo_rgba, dtype=np.float32) / 255.0
border_np = np.array(border_img, dtype=np.float32) / 255.0
shadow_np = np.array(logo_shadow, dtype=np.float32) / 255.0
logo_mask_np = np.array(mask, dtype=np.float32) / 255.0

# ----------------------------------------------------------------
# ANÉIS GIRATÓRIOS (arcos com cauda de alfa), rotacionados a cada frame
# ----------------------------------------------------------------
def make_ring(size, arc_deg, width_px, color, max_alpha):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size // 2
    r = size // 2 - width_px // 2 - 2
    start = -arc_deg / 2
    steps = 90
    for i in range(steps):
        a0 = math.radians(start + arc_deg * i / steps)
        a1 = math.radians(start + arc_deg * (i + 1) / steps) + 0.02
        fade = 1 - i / steps
        alpha = int(max_alpha * (fade ** 1.6))
        if alpha <= 2:
            continue
        d.arc([cx - r, cy - r, cx + r, cy + r], math.degrees(a0), math.degrees(a1),
              fill=color + (alpha,), width=width_px)
    return img

RING1_SIZE = 430
RING2_SIZE = 486
ring1 = make_ring(RING1_SIZE, 125, 7, (138, 43, 61), 235)   # vinho
ring2 = make_ring(RING2_SIZE, 78, 5, (168, 70, 86), 150)    # rosé intenso
# escala 2x para rotacionar com menos serrilhado
ring1 = ring1.resize((RING1_SIZE * 2, RING1_SIZE * 2), Image.LANCZOS)
ring2 = ring2.resize((RING2_SIZE * 2, RING2_SIZE * 2), Image.LANCZOS)
R1 = np.array(ring1, dtype=np.float32) / 255.0
R2 = np.array(ring2, dtype=np.float32) / 255.0

# ----------------------------------------------------------------
# BRILHINHOS (estrela de 4 pontas)
# ----------------------------------------------------------------
def make_spark(size, color):
    img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size * 2
    r_long, r_short = size * 1.85, size * 0.42
    pts = [(c, c - r_long), (c + r_short, c - r_short), (c + r_long, c),
           (c + r_short, c + r_short), (c, c + r_long),
           (c - r_short, c + r_short), (c - r_long, c), (c - r_short, c - r_short)]
    d.polygon(pts, fill=color + (255,))
    img = img.resize((size, size), Image.LANCZOS)
    return np.array(img, dtype=np.float32) / 255.0

spark_sprites = [make_spark(26, (201, 138, 153)),
                 make_spark(16, (201, 138, 153)),
                 make_spark(11, (168, 112, 124))]

sparks = []
for i in range(34):
    sprite = random.choice(spark_sprites)
    sparks.append({
        "x": random.uniform(W * 0.08, W * 0.92),
        "y0": random.uniform(0, H),
        "speed": random.uniform(8, 22),          # px por segundo (sobe)
        "phase": random.uniform(0, math.tau),
        "freq": random.uniform(0.9, 1.6),        # Hz do cintilar
        "sprite": sprite,
    })

# ----------------------------------------------------------------
# FAIXA DE BRILHO (shine sweep) — desliza na diagonal a cada ~3s
# ----------------------------------------------------------------
shine_np = None
def make_shine():
    sw, sh = 260, 700
    img = Image.new("L", (sw, sh), 0)
    d = ImageDraw.Draw(img)
    for i in range(sw):
        p = abs(i - sw / 2) / (sw / 2)
        alpha = int(180 * max(0, 1 - p) ** 2.4)
        d.line([(i, 0), (i, sh)], fill=alpha)
    img = img.rotate(-24, expand=True, resample=Image.BICUBIC)
    return np.array(img, dtype=np.float32) / 255.0

shine_np = make_shine()

# ----------------------------------------------------------------
# Função de blend alfa (add sobre o frame)
# ----------------------------------------------------------------
def paste_rgba(frame, src, top, left, scale=1.0):
    """src: array RGBA float32 0-1."""
    h, w = src.shape[:2]
    if scale != 1.0:
        new_w, new_h = max(2, int(w * scale)), max(2, int(h * scale))
        src = np.array(Image.fromarray((src * 255).astype(np.uint8)).resize(
            (new_w, new_h), Image.LANCZOS), dtype=np.float32) / 255.0
        h, w = src.shape[:2]
    x0, y0 = max(0, left), max(0, top)
    x1, y1 = min(left + w, W), min(top + h, H)
    if x1 <= x0 or y1 <= y0:
        return
    ox, oy = x0 - left, y0 - top
    src_c = src[oy:oy + (y1 - y0), ox:ox + (x1 - x0)]
    a = src_c[..., 3:4]
    frame[y0:y1, x0:x1] = src_c[..., :3] * a + frame[y0:y1, x0:x1] * (1 - a)

# ----------------------------------------------------------------
# RENDER
# ----------------------------------------------------------------
fourcc = cv2.VideoWriter_fourcc(*"avc1")
writer = cv2.VideoWriter(OUT, fourcc, FPS, (W, H))
if not writer.isOpened():
    print("avc1 indisponível, usando mp4v")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(OUT, fourcc, FPS, (W, H))
assert writer.isOpened(), "Não foi possível abrir o VideoWriter"

CX, CY_BASE = W / 2, H * 0.42
RING1_ANG_SPEED = 360 / 8.5      # graus/s
RING2_ANG_SPEED = -360 / 13.5

for f in range(FRAMES):
    tt = f / FPS

    frame = base.copy()

    # aura pulsante
    aura_strength = 0.42 + 0.16 * math.sin(tt * math.tau / 5.2)
    frame += AURA[None, None, :] * (aura_mask[:, :, None] * aura_strength)

    # vinheta
    frame *= vinheta

    # entrada do palco (0–1.1s)
    p = min(1.0, tt / 1.1)
    ease = 1 - (1 - p) ** 3
    stage_alpha = ease
    logo_scale = 0.86 + 0.14 * ease

    # flutuação vertical da logo
    float_y = math.sin(tt * math.tau / 4.6) * 8

    logo_d = int(LOGO_D * logo_scale)
    cx, cy = int(CX - logo_d / 2), int(CY_BASE - logo_d / 2 + float_y)

    # sombra
    sh_top = int(cy - shadow_pad + float_y * 0.4)
    sh_left = int(cx - shadow_pad)
    paste_rgba(frame, shadow_np, sh_top, sh_left)

    # anel externo (gira devagar no sentido horário)
    ang1 = (tt * RING1_ANG_SPEED) % 360
    M = cv2.getRotationMatrix2D((R1.shape[1] / 2, R1.shape[0] / 2), -ang1, 1.0)
    ring1_rot = cv2.warpAffine(R1, M, (R1.shape[1], R1.shape[0]), flags=cv2.INTER_LINEAR,
                               borderValue=(0, 0, 0, 0))
    rw = ring1_rot.shape[1] // 2  # estava em 2x
    paste_rgba(frame, ring1_rot, int(CY_BASE - RING1_SIZE / 2 + float_y), int(CX - RING1_SIZE / 2), scale=0.5)

    # anel externo 2 (inverso)
    ang2 = (tt * RING2_ANG_SPEED) % 360
    M = cv2.getRotationMatrix2D((R2.shape[1] / 2, R2.shape[0] / 2), -ang2, 1.0)
    ring2_rot = cv2.warpAffine(R2, M, (R2.shape[1], R2.shape[0]), flags=cv2.INTER_LINEAR,
                               borderValue=(0, 0, 0, 0))
    paste_rgba(frame, ring2_rot, int(CY_BASE - RING2_SIZE / 2 + float_y), int(CX - RING2_SIZE / 2), scale=0.5)

    # logo + borda
    paste_rgba(frame, border_np, cy, cx, scale=logo_scale)
    paste_rgba(frame, logo_np, cy, cx, scale=logo_scale)

    # varredura de brilho na logo (a cada 2.9s, duração 1.15s)
    shine_period, shine_dur = 2.9, 1.15
    st = tt % shine_period
    if st < shine_dur:
        sp = st / shine_dur
        ease_shine = sp * sp * (3 - 2 * sp)  # smoothstep
        sweep = int(W * (1.35 - 2.7 * ease_shine))  # da direita para a esquerda
        sx = sweep - shine_np.shape[1] // 2
        sy = int(CY_BASE - shine_np.shape[0] / 2 + float_y - 60)

        # aplica o brilho apenas dentro do círculo da logo
        sh_x0, sh_y0 = max(0, sx), max(0, sy)
        sh_x1, sh_y1 = min(W, sx + shine_np.shape[1]), min(H, sy + shine_np.shape[0])
        if sh_x1 > sh_x0 and sh_y1 > sh_y0:
            src = shine_np[sh_y0 - sy: sh_y1 - sy, sh_x0 - sx: sh_x1 - sx]
            alpha = (src * 0.5)[:, :, None]
            # restringe ao círculo da logo
            lc = logo_d / 2
            yy2, xx2 = np.mgrid[sh_y0:sh_y1, sh_x0:sh_x1].astype(np.float32)
            d2 = ((xx2 - CX) / lc) ** 2 + ((yy2 - (CY_BASE + float_y)) / lc) ** 2
            logo_region = np.clip(1 - d2, 0, 1) ** 0.6
            alpha = alpha * logo_region[:, :, None]
            region = frame[sh_y0:sh_y1, sh_x0:sh_x1]
            frame[sh_y0:sh_y1, sh_x0:sh_x1] = region * (1 - alpha) + 255.0 * alpha

    # brilhinhos
    for sp in sparks:
        y = sp["y0"] - sp["speed"] * tt
        y = y % (H + 80) - 40
        tw = 0.5 + 0.5 * math.sin(tt * sp["freq"] * math.tau + sp["phase"])
        a = (tw ** 1.8) * 0.95
        if a <= 0.05:
            continue
        sprite = sp["sprite"].copy()
        sprite[..., 3] *= a
        h, w = sprite.shape[:2]
        ix, iy = int(sp["x"] - w / 2), int(y - h / 2)
        paste_rgba(frame, sprite, iy, ix)

    # fade-in global
    if stage_alpha < 1.0:
        frame = base * (1 - stage_alpha) + frame * stage_alpha

    frame = np.clip(frame, 0, 255).astype(np.uint8)
    writer.write(cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))

    if f % 60 == 0:
        print(f"frame {f}/{FRAMES}")

writer.release()
print("Vídeo salvo em:", OUT)
print("Tamanho:", round(os.path.getsize(OUT) / 1024 / 1024, 2), "MB")
