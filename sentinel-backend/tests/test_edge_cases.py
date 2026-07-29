"""Paket 5 — edge case testleri (parite testinden SONRA, bkz. CLAUDE.md
REVİZE İŞ PAKETLERİ tablosu, Paket 5 satırı): boş BBOX, bulutlu tarih,
kenar taşması, tek-tile aşımı.

Tile/boş-BBOX testleri `stac_ara`'yı mock'layarak network'süz ve
deterministik çalışır (madde: Paket 1.5 "İzole test et"). Bulutlu tarih
testi bilerek gerçek STAC'a gidiyor — Earth Search'ün cloud filtresinin
gerçekten çalıştığını doğrulamak için.
"""

from __future__ import annotations

import types

import numpy as np
import pandas as pd
import pytest

from src import scene_selection
from src.stac_fetch import BboxHatasi
from src.v2_validate import PATCH_BOYUTU, patch_cikar

ARNAVUTKOY_BBOX = (28.60, 41.10, 28.90, 41.35)


def _sahte_item(item_id: str, utm: int, lat_band: str, grid_sq: str, bulut: float = 0.0):
    return types.SimpleNamespace(
        id=item_id,
        properties={
            "mgrs:utm_zone": utm,
            "mgrs:latitude_band": lat_band,
            "mgrs:grid_square": grid_sq,
            "eo:cloud_cover": bulut,
        },
    )


# --- Boş BBOX / sahne bulunamadı (madde 3: sessiz boş sonuç YOK) ---


def test_bos_bbox_sahne_bulunamaz(monkeypatch):
    monkeypatch.setattr(scene_selection, "stac_ara", lambda *a, **k: [])
    with pytest.raises(scene_selection.SahneBulunamadiHatasi):
        scene_selection.en_iyi_sahneyi_sec(ARNAVUTKOY_BBOX, "2020-07-01")


def test_sahne_cifti_tek_tarih_eksikse_hata_dondurur(monkeypatch):
    """İki tarihten sadece biri için sahne yoksa da anlamlı hata dönmeli."""

    def sahte_ara(bbox, tarih_araligi, bulut_ust_siniri=10.0):
        if "2018" in tarih_araligi:
            return [_sahte_item("A", 35, "T", "PF")]
        return []

    monkeypatch.setattr(scene_selection, "stac_ara", sahte_ara)
    with pytest.raises(scene_selection.SahneBulunamadiHatasi):
        scene_selection.sahne_ciftini_sec(ARNAVUTKOY_BBOX, "2018-07-04", "2025-07-09")


# --- Bulutlu tarih: gerçek STAC'a karşı, imkansız derecede sıkı bulut eşiği ---


def test_asiri_bulutlu_esik_gercek_veriyle_sahne_bulunamaz():
    with pytest.raises(scene_selection.SahneBulunamadiHatasi):
        scene_selection.en_iyi_sahneyi_sec(
            ARNAVUTKOY_BBOX, "2018-07-04", bulut_ust_siniri=0.0001, gun_penceresi=15
        )


# --- Tek-tile aşımı (madde 7: mosaicleme YOK) ---


def test_tek_tile_bbox_tile_kimligini_dondurur(monkeypatch):
    monkeypatch.setattr(
        scene_selection,
        "stac_ara",
        lambda *a, **k: [_sahte_item("A", 35, "T", "PF"), _sahte_item("B", 35, "T", "PF")],
    )
    assert scene_selection.bbox_tile_dogrula(ARNAVUTKOY_BBOX) == "35TPF"


def test_tek_tile_asimi_tespit_edilir(monkeypatch):
    monkeypatch.setattr(
        scene_selection,
        "stac_ara",
        lambda *a, **k: [_sahte_item("A", 35, "T", "PF"), _sahte_item("B", 35, "T", "PG")],
    )
    with pytest.raises(scene_selection.TileSiniriAsimiHatasi):
        scene_selection.bbox_tile_dogrula(ARNAVUTKOY_BBOX)


def test_bbox_alan_limiti_tile_kontrolunden_once_calisir():
    """750 km² üstü bir BBOX, tile sorgusuna hiç gitmeden reddedilmeli."""
    cok_buyuk_bbox = (28.0, 40.8, 29.4, 41.6)  # ~10.400 km²
    with pytest.raises(BboxHatasi):
        scene_selection.bbox_tile_dogrula(cok_buyuk_bbox)


# --- Kenar taşması: patch BBOX dışına taşan poligonlar atlanır ---


def test_kenar_disina_tasan_patch_atlanir():
    """v2_validate.patch_cikar, 64x64 patch'i array sınırları dışına taşan
    poligonları atlar — bunlar sonradan 'doğrulanamadı' olur (parite testinde
    133 sayısıyla doğrulandı, burada saf mantık izole test ediliyor)."""
    x0, y0, cozunurluk = 0.0, 1000.0, 10.0
    H = W = 100
    rgb = np.zeros((3, H, W), dtype="float32")

    gdf = pd.DataFrame(
        {
            "merkez_x": [495.0, 95.0],  # ilki merkeze yakın (sığar), ikincisi köşeye yakın (taşar)
            "merkez_y": [505.0, 905.0],
        }
    )

    patches, idxler = patch_cikar(rgb, gdf, x0, y0, cozunurluk)

    assert idxler == [0]
    assert patches.shape == (1, 3, PATCH_BOYUTU, PATCH_BOYUTU)
