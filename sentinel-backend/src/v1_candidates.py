"""Paket 3: In-memory v1 — indeks tabanlı aday üretimi (model YOK).

dNDVI + dNDBI çift koşullu eşikleme, SCL/su maskesiyle birleştirme, alan
filtresi, vektörleştirme. **DL burada YOK** — v1 sadece indeks tabanlı aday
üretir; adayları CNN ile onaylamak/elemek Paket 4'ün (v2) işi.

Mevsim kısıtı (madde 4) burada doğrulanır: eşikler (dNDVI < -0.15 &
dNDBI > 0.20) temmuz-temmuz üzerinde kalibre edildi, mevsim kayarsa
vejetasyon farkı sahte yapılaşma üretir.
"""

from __future__ import annotations

from datetime import datetime

import geopandas as gpd
import numpy as np
import xarray as xr
from rasterio.features import shapes
from scipy import ndimage
from shapely.geometry import shape

IZIN_VERILEN_AYLAR = range(6, 10)  # Haziran(6)-Eylül(9), madde 4

# statik referans eşikleri — orijinal notebooktan (bkz. models/faz2-arnavutkoy-deg-s-m.ipynb,
# hücre d8d573be): -0.10/-0.15/-0.20/-0.25 NDVI x 0.15/0.20/0.25 NDBI taranmış,
# -0.15/0.20 seçilmiş. CLAUDE.md'de bir süre yanlışlıkla -0.30 yazılıydı — DÜZELTİLDİ.
DNDVI_ESIK = -0.15
DNDBI_ESIK = 0.20

MIN_PIKSEL = 10  # 10 m çözünürlükte 10 piksel = 0.1 ha


class MevsimHatasi(ValueError):
    """Tarih Haziran-Eylül dışındaysa (madde 4)."""


def mevsim_dogrula(tarih_once: str, tarih_sonra: str) -> None:
    """İki tarihin de Haziran-Eylül penceresinde olduğunu doğrular (madde 4)."""
    for tarih in (tarih_once, tarih_sonra):
        ay = datetime.strptime(tarih, "%Y-%m-%d").month
        if ay not in IZIN_VERILEN_AYLAR:
            raise MevsimHatasi(
                f"{tarih} Haziran-Eylül penceresi dışında (ay={ay}). Eşikler "
                "(dNDVI<-0.15 & dNDBI>0.20) bu mevsim penceresi için kalibre "
                "edildi; ilk sürümde iki tarih de bu pencereye zorlanıyor."
            )


def ndvi_hesapla(kirmizi: xr.DataArray, nir: xr.DataArray) -> xr.DataArray:
    """NDVI = (nir-kırmızı)/(nir+kırmızı). Ham DN üzerinden hesaplanır — orijinal
    notebook BOA offset düzeltmesi yapmıyor (bkz. CLAUDE.md madde 5 notu);
    parite için bilerek aynı şekilde ham DN kullanılıyor."""
    kirmizi = kirmizi.astype("float32")
    nir = nir.astype("float32")
    with np.errstate(invalid="ignore", divide="ignore"):
        return (nir - kirmizi) / (nir + kirmizi)


def ndbi_hesapla(nir: xr.DataArray, swir16: xr.DataArray) -> xr.DataArray:
    """NDBI = (swir16-nir)/(swir16+nir)."""
    nir = nir.astype("float32")
    swir16 = swir16.astype("float32")
    with np.errstate(invalid="ignore", divide="ignore"):
        return (swir16 - nir) / (swir16 + nir)


def aday_maskesi_uret(
    ds_once: xr.Dataset,
    ds_sonra: xr.Dataset,
    nihai_maske: xr.DataArray,
) -> tuple[np.ndarray, xr.DataArray, xr.DataArray]:
    """dNDVI/dNDBI hesaplar; eşikler + SCL/su maskesiyle aday piksel maskesini üretir.

    fark = sonra - önce (bkz. STATİK REFERANS PARAMETRELERİ).
    Dönen: (aday_maskesi bool numpy array, dndvi DataArray, dndbi DataArray)
    """
    dndvi = ndvi_hesapla(ds_sonra["red"], ds_sonra["nir"]) - ndvi_hesapla(
        ds_once["red"], ds_once["nir"]
    )
    dndbi = ndbi_hesapla(ds_sonra["nir"], ds_sonra["swir16"]) - ndbi_hesapla(
        ds_once["nir"], ds_once["swir16"]
    )

    esik_maskesi = (dndvi < DNDVI_ESIK) & (dndbi > DNDBI_ESIK)
    aday = (esik_maskesi & nihai_maske).fillna(False).values
    return aday, dndvi, dndbi


def poligonlara_donustur(aday_maskesi: np.ndarray, ds_referans: xr.Dataset) -> gpd.GeoDataFrame:
    """Aday piksel maskesini vektörleştirir: connected-component + alan filtresi + poligon.

    ds_referans yalnızca doğru CRS/transform için kullanılır (reproject_match
    sonrası iki tarih de aynı grid'te olduğundan hangisi verilirse verilsin
    fark etmez).
    """
    etiketli, sayisi = ndimage.label(aday_maskesi)
    if sayisi == 0:
        return gpd.GeoDataFrame({"alan_m2": [], "alan_ha": []}, geometry=[], crs=ds_referans.rio.crs)

    boyutlar = ndimage.sum(aday_maskesi, etiketli, index=np.arange(1, sayisi + 1))
    buyuk_etiketler = np.arange(1, sayisi + 1)[boyutlar >= MIN_PIKSEL]
    if len(buyuk_etiketler) == 0:
        return gpd.GeoDataFrame({"alan_m2": [], "alan_ha": []}, geometry=[], crs=ds_referans.rio.crs)

    filtreli_maske = np.isin(etiketli, buyuk_etiketler)
    filtreli_etiketli = np.where(filtreli_maske, etiketli, 0).astype("int32")

    transform = ds_referans.rio.transform()
    geometriler = []
    etiket_degerleri = []
    for geom, deger in shapes(filtreli_etiketli, mask=filtreli_maske, transform=transform):
        geometriler.append(shape(geom))
        etiket_degerleri.append(int(deger))

    gdf = gpd.GeoDataFrame({"etiket": etiket_degerleri}, geometry=geometriler, crs=ds_referans.rio.crs)
    gdf["alan_m2"] = gdf.geometry.area
    gdf["alan_ha"] = gdf["alan_m2"] / 10_000
    gdf["merkez"] = gdf.geometry.representative_point()  # centroid DEĞİL
    return gdf
