"""Paket 5 — parite testi (atlanamaz, bkz. CLAUDE.md PARİTE TESTİ bölümü).

`analiz_calistir_sahnelerle()`'yi statik Arnavutköy referans sahneleriyle
çağırıp `data/analiz_ozeti.json`'daki sonuçları reprodükte eder.

Sahne SEÇİMİ (scene_selection.py, Paket 1.5) burada bilerek ATLANIYOR —
±15-20 gün penceresinde "en düşük bulutluyu seç" politikası, tam bu
tarihler girilse bile referanstan FARKLI bir sahne seçebilir (gözlemlendi:
2025-07-09 yerine 2025-07-22). Bu test yerine tam sahne ID'lerini STAC'tan
tarihe göre (tek günlük aralık) doğrudan çeker.

v1 (aday poligon) + kenar (doğrulanamadı) TAM eşleşmeli — deterministik
hesaplardır. v2 (CNN onay/eleme) için ±%5 tolerans var — PyTorch/timm'in
ortamlar arası bit-birebir tekrarlanabilirliği garanti edilemez (bkz.
PARİTE TESTİ bölümündeki ölçüm notu).
"""

from pathlib import Path

import pytest

from src.pipeline import analiz_calistir_sahnelerle
from src.stac_fetch import stac_ara

ARNAVUTKOY_BBOX = (28.60, 41.10, 28.90, 41.35)
TARIH_ONCE = "2018-07-04"
TARIH_SONRA = "2025-07-09"
CHECKPOINT = str(Path(__file__).parent.parent / "models" / "best_effnetb0_rgb.pt")

REFERANS = {
    "aday_poligon": 2584,
    "dogrulanamadi": 133,
    "onaylandi": 1227,
    "elendi": 1224,
}
V2_TOLERANS = 0.05  # ±%5 — bkz. CLAUDE.md PARİTE TESTİ bölümü


def _en_dusuk_bulutlu(bbox, tarih):
    adaylar = stac_ara(bbox, f"{tarih}/{tarih}", bulut_ust_siniri=100)
    return min(adaylar, key=lambda it: it.properties.get("eo:cloud_cover", 999))


@pytest.fixture(scope="module")
def analiz_sonucu():
    item_once = _en_dusuk_bulutlu(ARNAVUTKOY_BBOX, TARIH_ONCE)
    item_sonra = _en_dusuk_bulutlu(ARNAVUTKOY_BBOX, TARIH_SONRA)
    return analiz_calistir_sahnelerle(
        item_once, item_sonra, ARNAVUTKOY_BBOX, TARIH_ONCE, TARIH_SONRA, CHECKPOINT
    )


def test_v1_aday_poligon_tam_esmeli(analiz_sonucu):
    assert analiz_sonucu["sonuclar"]["aday_poligon"] == REFERANS["aday_poligon"]


def test_kenar_dogrulanamadi_tam_esmeli(analiz_sonucu):
    assert analiz_sonucu["sonuclar"]["dogrulanamadi"] == REFERANS["dogrulanamadi"]


def test_v2_onaylandi_tolerans_icinde(analiz_sonucu):
    onaylandi = analiz_sonucu["sonuclar"]["onaylandi"]
    beklenen = REFERANS["onaylandi"]
    assert abs(onaylandi - beklenen) / beklenen <= V2_TOLERANS, (
        f"onaylandi={onaylandi}, beklenen={beklenen}, tolerans=±%{V2_TOLERANS*100:.0f}"
    )


def test_v2_elendi_tolerans_icinde(analiz_sonucu):
    elendi = analiz_sonucu["sonuclar"]["elendi"]
    beklenen = REFERANS["elendi"]
    assert abs(elendi - beklenen) / beklenen <= V2_TOLERANS, (
        f"elendi={elendi}, beklenen={beklenen}, tolerans=±%{V2_TOLERANS*100:.0f}"
    )
