"""Paket 2: Ön işleme — reproject_match (güvenlik ağı) + SCL maskesi.

Histogram eşleme YOK (madde 2) — karşılaştırılabilirlik aynı tile + aynı
mevsim + aynı uydu + L2A BOA ile sağlanıyor, radyometrik düzeltmeye gerek
yok. `reproject_match` burada bir "düzeltme" değil, bir **güvenlik ağı**:
iki tarih aynı tile'a düşse bile farklı BBOX pencereleme veya farklı
alt-tile/orbit STAC Item'ları piksel grid'inde ufak kaymalara yol açabilir;
bu fonksiyon iki tarihi aynı piksel grid'ine hizalar, piksel DEĞERLERİNİ
değiştirmez.
"""

from __future__ import annotations

from src import _gis_env  # noqa: F401 — rasterio'dan ONCE calismali

import rioxarray  # noqa: F401 — xarray'e .rio accessor'ini kaydeder
import xarray as xr

# madde: statik referans maskeleri
GECERLI_SCL_SINIFLARI = (4, 5, 6, 7)
SU_SCL_SINIFI = 6


def reproject_match(kaynak: xr.Dataset, hedef: xr.Dataset) -> xr.Dataset:
    """kaynak Dataset'i hedef'in piksel grid'ine (CRS + transform + shape) hizalar.

    Güvenlik ağı — histogram eşleme YAPMAZ, sadece piksel hizalama (madde 2/3).
    """
    return kaynak.rio.reproject_match(hedef)


def gecerlilik_maskesi(scl_once: xr.DataArray, scl_sonra: xr.DataArray) -> xr.DataArray:
    """Her iki tarihte de geçerli SCL sınıfına (4,5,6,7) sahip pikselleri True yapar."""
    gecerli_once = scl_once.isin(GECERLI_SCL_SINIFLARI)
    gecerli_sonra = scl_sonra.isin(GECERLI_SCL_SINIFLARI)
    return gecerli_once & gecerli_sonra


def su_maskesi(scl_once: xr.DataArray, scl_sonra: xr.DataArray) -> xr.DataArray:
    """Herhangi bir tarihte su (SCL=6) olan pikselleri True (dışla) yapar."""
    return (scl_once == SU_SCL_SINIFI) | (scl_sonra == SU_SCL_SINIFI)


def nihai_maske(scl_once: xr.DataArray, scl_sonra: xr.DataArray) -> xr.DataArray:
    """Analizde kullanılacak piksel maskesi: geçerli VE su değil."""
    return gecerlilik_maskesi(scl_once, scl_sonra) & ~su_maskesi(scl_once, scl_sonra)
