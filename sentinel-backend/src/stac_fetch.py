"""Paket 1: STAC arama + BBOX veri çekme.

STAC (SpatioTemporal Asset Catalog) — uydu görüntülerini metadata ile arayıp
bulmaya yarayan bir standart. "Bana şu BBOX + tarih aralığında, şu bulut
oranının altındaki Sentinel-2 sahnelerini listele" diye sorgu atmanı sağlar;
gerçek görüntü verisini indirmeden önce hangi sahnenin işine yaradığını
öğrenirsin (görüntüler onlarca GB olabiliyor, hepsini indirip bakamazsın).
"""

from __future__ import annotations

from src import _gis_env  # noqa: F401 — rasterio/odc.stac'tan ONCE calismali (bkz. modul docstring'i)

import odc.stac
import xarray as xr
from pyproj import Geod
from pystac_client import Client

BBOX_ALAN_LIMIT_KM2 = 750.0

STAC_URL = "https://earth-search.aws.element84.com/v1"
KOLEKSIYON = "sentinel-2-l2a"
# madde 1: B02/B03/B04/B08/B11/SCL — ama Earth Search STAC asset anahtarları
# ham bant kodu değil, eo:common_name karşılıkları (blue/green/red/nir/swir16/scl).
BANTLAR = ["blue", "green", "red", "nir", "swir16", "scl"]

# WGS84 elipsoidi üzerinde geodezik hesap yapan nesne — modül yüklenirken bir
# kere oluşturulur, her çağrıda yeniden kurmaya gerek yok.
_GEOD = Geod(ellps="WGS84")


class BboxHatasi(ValueError):
    """BBOX doğrulaması başarısız olduğunda fırlatılır (madde 6)."""


def bbox_alani_km2(bbox: tuple[float, float, float, float]) -> float:
    """BBOX'ın gerçek (geodezik) alanını km² cinsinden hesaplar.

    bbox: (min_lon, min_lat, max_lon, max_lat), WGS84 derece.

    Basit `(lon2-lon1)*(lat2-lat1)*111**2` KULLANILMAZ: 1° boylamın km
    karşılığı enleme göre küçülür (ekvatorda ~111 km, İstanbul'da ~83 km).
    Geod.polygon_area_perimeter dört köşeyi WGS84 elipsoidi üzerinde gerçek
    bir poligon olarak değerlendirip doğru alanı verir.
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    lons = [min_lon, max_lon, max_lon, min_lon]
    lats = [min_lat, min_lat, max_lat, max_lat]
    alan_m2, _cevre = _GEOD.polygon_area_perimeter(lons, lats)
    return abs(alan_m2) / 1_000_000


def bbox_dogrula(bbox: tuple[float, float, float, float]) -> None:
    """BBOX'ı doğrular: köşe sırası + 750 km² üst sınırı (madde 6).

    Sessizce None döner (geçerliyse); geçersizse BboxHatasi fırlatır — madde
    3'teki "sessiz boş sonuç yerine anlamlı hata" felsefesiyle tutarlı.
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    if min_lon >= max_lon or min_lat >= max_lat:
        raise BboxHatasi(
            f"Geçersiz BBOX: min köşe max köşeden küçük olmalı. Alınan: {bbox}"
        )

    alan = bbox_alani_km2(bbox)
    if alan > BBOX_ALAN_LIMIT_KM2:
        raise BboxHatasi(
            f"BBOX alanı {alan:.1f} km², izin verilen üst sınır "
            f"{BBOX_ALAN_LIMIT_KM2:.0f} km². Alanı küçültün."
        )


def stac_ara(
    bbox: tuple[float, float, float, float],
    tarih_araligi: str,
    bulut_ust_siniri: float = 10.0,
):
    """Element84 Earth Search üzerinde sentinel-2-l2a sahnelerini arar.

    tarih_araligi: STAC'ın beklediği ISO aralık string'i, ör. "2018-06-15/2018-07-25".
    Dönen liste ham STAC Item'ları — sahne SEÇİMİ (en düşük bulutlu, tile
    tercihi vb.) burada değil, Paket 1.5 (scene_selection.py) içinde yapılır.
    """
    bbox_dogrula(bbox)

    client = Client.open(STAC_URL)
    arama = client.search(
        collections=[KOLEKSIYON],
        bbox=bbox,
        datetime=tarih_araligi,
        query={"eo:cloud_cover": {"lt": bulut_ust_siniri}},
    )
    return list(arama.items())


def bantlari_yukle(
    items: list,
    bbox: tuple[float, float, float, float],
    epsg: int = 32635,
    cozunurluk: int = 10,
) -> xr.Dataset:
    """Verilen STAC Item'lardan 6 bandı belleğe stream eder (odc-stac).

    STAC Item'lar sadece metadata + COG (Cloud-Optimized GeoTIFF) URL'leri
    taşır; asıl piksel verisi burada, sadece istenen BBOX + çözünürlük için
    indirilir. COG formatı sayesinde tüm sahneyi indirmeye gerek yok.

    Dönen bantlar HAM DN (uint16) — reflectansa çevrilmez. ESA processing
    baseline ≥04.00'te bantlara +1000 DN sabit ofset eklendi
    (`raster:bands.offset` ile deklare ediliyor); orijinal referans notebook
    (models/faz2-arnavutkoy-deg-s-m.ipynb) bunu düzeltmeden ham DN ile
    çalışıyor (bkz. CLAUDE.md madde 5 notu) — parite için bilerek aynı
    şekilde bırakıldı. Ofset düzeltmesi ileride ayrı, bilinçli bir karar
    olarak ele alınabilir ama parite testini bozmadan ÖNCE yapılmamalı.

    Dönen xarray.Dataset boyutları: (time, y, x), her bant ayrı bir
    değişken. epsg=32635 → UTM 35N (İstanbul bölgesi, statik referansla
    aynı CRS — parite testi için önemli).
    """
    return odc.stac.load(
        items,
        bands=BANTLAR,
        bbox=bbox,
        crs=f"EPSG:{epsg}",
        resolution=cozunurluk,
    )
