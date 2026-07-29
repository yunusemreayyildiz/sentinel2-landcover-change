"""Paket 4: In-memory v2 — CNN doğrulama (EfficientNet-B0 + istatistik eşleme).

**DL burada FİLTRE, dedektör DEĞİL** — v1'in ürettiği adayları onaylar/eler,
kendisi yeni aday önermez (bkz. CLAUDE.md Mimari).

Domain-shift düzeltmesi (madde 5) ZORUNLU: patch'ler EuroSAT eğitim
istatistiklerine doğrusal olarak eşlenir; atlanırsa "SeaLake patlaması"
(yanlış sınıflandırma) oluşur — Sentinel-2 COG (TOA/BOA benzeri parlaklık)
ile EuroSAT eğitim verisi arasındaki dağılım farkının sonucu.
"""

from __future__ import annotations

import numpy as np
import timm
import torch
import xarray as xr

CLASSES = [
    "AnnualCrop", "Forest", "HerbaceousVegetation", "Highway", "Industrial",
    "Pasture", "PermanentCrop", "Residential", "River", "SeaLake",
]

# madde 5: EuroSAT hedef istatistikleri (RGB, /10000 sonrası reflectans)
ES_MEAN = np.array([0.0946, 0.1041, 0.1117], dtype="float32")
ES_STD = np.array([0.0596, 0.0397, 0.0333], dtype="float32")

PATCH_BOYUTU = 64

YAPILASMA_SINIFLARI = {"Industrial", "Residential", "Highway"}
GUVEN_ESIGI = 0.5


def model_yukle(checkpoint_yolu: str, device: str = "cpu"):
    """EfficientNet-B0'ı (EuroSAT, 10 sınıf) checkpoint'ten yükler."""
    model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=len(CLASSES))
    durum = torch.load(checkpoint_yolu, map_location=device)
    model.load_state_dict(durum)
    model.to(device).eval()
    return model


def rgb_dizisi_uret(ds_sonra: xr.Dataset) -> np.ndarray:
    """Sonra (2. tarih) görüntüsünden model girdisi RGB dizisi üretir: [3,H,W], 0-1 clip.

    Kanal sırası (red,green,blue) — madde 5'teki 'RGB [3,2,1]' ile aynı.
    ds_sonra tek zamanlı (2D) olmalı — reproject_match sonrası ds.isel(time=..)
    çıktısı.
    """
    rgb = np.stack([ds_sonra["red"].values, ds_sonra["green"].values, ds_sonra["blue"].values])
    return np.clip(rgb.astype("float32") / 10000.0, 0, 1)


def utm_to_piksel(mx: float, my: float, x0: float, y0: float, cozunurluk: float = 10.0) -> tuple[int, int]:
    """UTM merkez koordinatını (mx,my) piksel (row,col)'a çevirir.

    x0,y0: referans dataset'in ilk piksel MERKEZ koordinatı (ds.x[0], ds.y[0]).
    ±yarım piksel kayması merkez→köşe dönüşümü (bkz. STATİK REFERANS
    PARAMETRELERİ — v1_candidates.py'deki poligon transformuyla aynı mantık).
    """
    col = int((mx - (x0 - cozunurluk / 2)) / cozunurluk)
    row = int(((y0 + cozunurluk / 2) - my) / cozunurluk)
    return row, col


def patch_cikar(rgb: np.ndarray, gdf, x0: float, y0: float, cozunurluk: float = 10.0):
    """Her poligon merkezinden PATCH_BOYUTU×PATCH_BOYUTU RGB patch keser.

    Kenar dışına taşan poligonlar ATLANIR (dönen idxler'de olmaz) — bunlar
    sonradan "doğrulanamadı" olur (kenar dürüstlüğü, bkz. KAPSAM SINIRLARI).

    Dönen: (patches np.ndarray [N,3,64,64], idxler — gdf index listesi)
    """
    yarim = PATCH_BOYUTU // 2
    H, W = rgb.shape[1:]
    patches, idxler = [], []
    for idx, satir in gdf.iterrows():
        r, c = utm_to_piksel(satir["merkez_x"], satir["merkez_y"], x0, y0, cozunurluk)
        r0, c0 = r - yarim, c - yarim
        if 0 <= r0 and r0 + PATCH_BOYUTU <= H and 0 <= c0 and c0 + PATCH_BOYUTU <= W:
            patches.append(rgb[:, r0:r0 + PATCH_BOYUTU, c0:c0 + PATCH_BOYUTU])
            idxler.append(idx)
    if not patches:
        return np.empty((0, 3, PATCH_BOYUTU, PATCH_BOYUTU), dtype="float32"), []
    return np.stack(patches), idxler


def istatistik_esle(patches: np.ndarray) -> np.ndarray:
    """Patch'leri EuroSAT eğitim dağılımına doğrusal olarak eşler (madde 5, ZORUNLU).

    Bizim patch istatistiklerimizle (kanal başına mean/std, tüm patch'ler
    üzerinden) normalize edip EuroSAT hedef istatistiklerine yeniden ölçekler.
    Atlanırsa "SeaLake patlaması" oluşur.
    """
    biz_mean = patches.mean(axis=(0, 2, 3), keepdims=True)
    biz_std = patches.std(axis=(0, 2, 3), keepdims=True)
    eslenmis = (patches - biz_mean) / biz_std * ES_STD.reshape(1, 3, 1, 1) + ES_MEAN.reshape(1, 3, 1, 1)
    return np.clip(eslenmis, 0, 1).astype("float32")


def toplu_tahmin(model, patches: np.ndarray, device: str = "cpu", parca_boyutu: int = 256):
    """Eşlenmiş patch'leri modelden geçirir; (sınıf_indeksleri, güvenler) döner."""
    X = torch.tensor(patches)
    tahminler, guvenler = [], []
    with torch.no_grad():
        for b in range(0, len(X), parca_boyutu):
            cikti = model(X[b:b + parca_boyutu].to(device)).softmax(1)
            p = cikti.max(1)
            tahminler += p.indices.cpu().tolist()
            guvenler += p.values.cpu().tolist()
    return tahminler, guvenler


def durum_belirle(gdf):
    """Eleme kuralı: sınıf ∈ {Industrial,Residential,Highway} VE güven≥0.5 → onaylandı.

    Boş sınıf None/NaN olabilir; notebook'ta string "nan" olarak da
    görülebildiği için `isna()` tek başına yetmez (bkz. STATİK REFERANS
    PARAMETRELERİ).
    """
    gdf = gdf.copy()
    bos = gdf["sinif"].isna() | (gdf["sinif"].astype(str) == "nan")
    gdf["durum"] = "elendi"
    gdf.loc[bos, "durum"] = "dogrulanamadi"
    gdf.loc[gdf["sinif"].isin(YAPILASMA_SINIFLARI) & (gdf["guven"] >= GUVEN_ESIGI), "durum"] = "onaylandi"
    return gdf


def v2_dogrula(gdf, ds_sonra: xr.Dataset, checkpoint_yolu: str, device: str = "cpu"):
    """Paket 4'ün ana girişi: gdf'ye 'sinif', 'guven', 'durum' kolonlarını ekler.

    Kenar dışına taşan poligonlar (patch çıkarılamayanlar) sinif=None kalır
    → durum_belirle() bunları "doğrulanamadı" yapar (gizlenmez).
    """
    gdf = gdf.copy()
    gdf["merkez_x"] = gdf["merkez"].apply(lambda p: p.x)
    gdf["merkez_y"] = gdf["merkez"].apply(lambda p: p.y)

    x0 = float(ds_sonra["x"].values[0])
    y0 = float(ds_sonra["y"].values[0])

    rgb = rgb_dizisi_uret(ds_sonra)
    patches, idxler = patch_cikar(rgb, gdf, x0, y0)

    gdf["sinif"] = None
    gdf["guven"] = np.nan

    if idxler:
        eslenmis = istatistik_esle(patches)
        model = model_yukle(checkpoint_yolu, device)
        tahminler, guvenler = toplu_tahmin(model, eslenmis, device)
        gdf.loc[idxler, "sinif"] = [CLASSES[t] for t in tahminler]
        gdf.loc[idxler, "guven"] = guvenler

    return durum_belirle(gdf)
