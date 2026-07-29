"""src/pipeline.py — pipeline orchestrator (analiz_calistir).

Tüm modülleri birleştirir: STAC arama/yükleme (Paket 1) → sahne seçimi
(Paket 1.5) → ön işleme (Paket 2) → v1 aday üretimi (Paket 3) → v2 CNN
doğrulama (Paket 4). İki fonksiyon vardır — bkz. CLAUDE.md PARİTE TESTİ
bölümü, neden ayrıldıkları:

- `analiz_calistir` — kullanıcı akışı, sahne seçimini kendisi yapar.
- `analiz_calistir_sahnelerle` — sahne seçimini ATLAYIP doğrudan verilen iki
  STAC Item ile çalışır; parite testi (tests/test_parity.py) bunu kullanır.
"""

from __future__ import annotations

from src import _gis_env  # noqa: F401 — rasterio/odc.stac'tan ÖNCE çalışmalı

from src.preprocess import nihai_maske as nihai_maske_hesapla
from src.preprocess import reproject_match
from src.scene_selection import sahne_ciftini_sec
from src.stac_fetch import bantlari_yukle
from src.v1_candidates import DNDBI_ESIK, DNDVI_ESIK, aday_maskesi_uret, mevsim_dogrula, poligonlara_donustur
from src.v2_validate import GUVEN_ESIGI, v2_dogrula

PROJE_ADI = "Sentinel-2 Arazi Örtüsü Değişim Tespiti"


def analiz_calistir_sahnelerle(
    item_once,
    item_sonra,
    bbox: tuple[float, float, float, float],
    tarih_once: str,
    tarih_sonra: str,
    checkpoint_yolu: str,
    device: str = "cpu",
) -> dict:
    """Sahne seçimini ATLAYIP doğrudan verilen iki STAC Item ile çalışır.

    Parite testi (tests/test_parity.py) bu fonksiyonu statik referans
    sahneleriyle çağırır — Paket 1.5'in "pencere içinde en düşük bulutluyu
    seç" politikası farklı bir sahne seçebildiği için (bkz. PARİTE TESTİ
    bölümü), parite sahne seçimini değil geri kalan pipeline'ı test eder.
    """
    mevsim_dogrula(tarih_once, tarih_sonra)

    ds_once = bantlari_yukle([item_once], bbox)
    ds_sonra = bantlari_yukle([item_sonra], bbox)
    ds_once = reproject_match(ds_once, ds_sonra)

    ds_once_0 = ds_once.isel(time=0)
    ds_sonra_0 = ds_sonra.isel(time=0)

    maske = nihai_maske_hesapla(ds_once_0["scl"], ds_sonra_0["scl"])
    aday_maskesi, _dndvi, _dndbi = aday_maskesi_uret(ds_once_0, ds_sonra_0, maske)
    gdf = poligonlara_donustur(aday_maskesi, ds_sonra_0)

    gdf = v2_dogrula(gdf, ds_sonra_0, checkpoint_yolu, device)

    return _ozet_uret(gdf, bbox, tarih_once, tarih_sonra, item_once, item_sonra)


def analiz_calistir(
    bbox: tuple[float, float, float, float],
    tarih_once: str,
    tarih_sonra: str,
    checkpoint_yolu: str,
    device: str = "cpu",
) -> dict:
    """Kullanıcı akışı: Paket 1.5 (scene_selection) ile sahneleri seçer, sonra
    analiz_calistir_sahnelerle()'ye devreder. main.py /analiz burayı çağırır."""
    item_once, item_sonra = sahne_ciftini_sec(bbox, tarih_once, tarih_sonra)
    return analiz_calistir_sahnelerle(
        item_once, item_sonra, bbox, tarih_once, tarih_sonra, checkpoint_yolu, device
    )


def _ozet_uret(gdf, bbox, tarih_once, tarih_sonra, item_once, item_sonra) -> dict:
    """gdf'den analiz_ozeti.json şemasıyla aynı dict'i üretir."""
    aday_poligon = int(len(gdf))
    onaylandi = int((gdf["durum"] == "onaylandi").sum())
    elendi = int((gdf["durum"] == "elendi").sum())
    dogrulanamadi = int((gdf["durum"] == "dogrulanamadi").sum())

    onayli = gdf[gdf["durum"] == "onaylandi"]
    onayli_alan_ha = round(float(onayli["alan_ha"].sum()), 1)
    toplam_alan_ha = float(gdf["alan_ha"].sum())

    en_buyuk = onayli.nlargest(10, "alan_ha").copy()
    merkezler_wgs84 = en_buyuk.geometry.representative_point().to_crs(4326)
    en_buyuk_10 = [
        {
            "alan_ha": round(float(satir.alan_ha), 2),
            "sinif": satir.sinif,
            "guven": round(float(satir.guven), 3),
            "merkez_lat": round(pt.y, 5),
            "merkez_lon": round(pt.x, 5),
        }
        for satir, pt in zip(en_buyuk.itertuples(), merkezler_wgs84)
    ]

    return {
        "proje": PROJE_ADI,
        "aoi": {"bbox": list(bbox), "crs": "EPSG:4326"},
        "sahneler": {
            "once": f"{tarih_once} ({item_once.id})",
            "sonra": f"{tarih_sonra} ({item_sonra.id})",
        },
        "yontem": {
            "v1": f"dNDVI < {DNDVI_ESIK} & dNDBI > {DNDBI_ESIK}, SCL su+geçerlilik maskesi, min alan 0.1 ha",
            "v2": f"EfficientNet-B0 (EuroSAT) + istatistik eşleme, güven >= {GUVEN_ESIGI}",
            "cnn_onay": {
                "poligon_orani": round(onaylandi / aday_poligon, 2) if aday_poligon else 0.0,
                "alan_orani": round(onayli_alan_ha / toplam_alan_ha, 2) if toplam_alan_ha else 0.0,
            },
        },
        "sonuclar": {
            "aday_poligon": aday_poligon,
            "onaylandi": onaylandi,
            "elendi": elendi,
            "dogrulanamadi": dogrulanamadi,
            "onayli_alan_ha": onayli_alan_ha,
            "sinif_dagilimi": onayli["sinif"].value_counts().to_dict(),
            "en_buyuk_10": en_buyuk_10,
        },
    }
