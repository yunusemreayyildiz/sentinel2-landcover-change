"""Paket 1.5: Sahne seçim politikası (madde 3, madde 7).

Paket 1 (stac_fetch.py) "ver ne varsa" seviyesinde çalışıyor: BBOX + tarih
aralığı + bulut eşiği verip STAC Item listesi alıyorsun. Bu modül üstüne
POLİTİKA katıyor: hangi tarihte hangi sahne "en iyisi", iki tarih birbiriyle
tutarlı mı, BBOX baştan makul mü.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from src.stac_fetch import bbox_dogrula, stac_ara

GUN_PENCERESI = 15  # ±15 gün (madde 3)
BULUT_UST_SINIRI = 10.0


class SahneBulunamadiHatasi(ValueError):
    """İstenen tarih + BBOX için uygun sahne bulunamadığında (madde 3)."""


class TileSiniriAsimiHatasi(ValueError):
    """BBOX birden fazla Sentinel-2 tile'ına düştüğünde (madde 7, mosaicleme yok)."""


def _tarih_penceresi(tarih: str, gun: int = GUN_PENCERESI) -> str:
    """tarih (YYYY-MM-DD) etrafında ±gun günlük STAC ISO aralığı üretir."""
    merkez = datetime.strptime(tarih, "%Y-%m-%d").date()
    baslangic = merkez - timedelta(days=gun)
    bitis = merkez + timedelta(days=gun)
    return f"{baslangic.isoformat()}/{bitis.isoformat()}"


def _tile_id(item) -> str:
    """STAC item'in MGRS tile kimliğini çıkarır (ör. '35TPF').

    Earth Search bunu properties'te mgrs:* olarak veriyor; yoksa item id'den
    parse eder (S2A_35TPF_20180704_1_L2A -> 35TPF).
    """
    props = item.properties
    utm = props.get("mgrs:utm_zone")
    lat_band = props.get("mgrs:latitude_band")
    grid_sq = props.get("mgrs:grid_square")
    if utm and lat_band and grid_sq:
        return f"{utm}{lat_band}{grid_sq}"
    parcalar = item.id.split("_")
    return parcalar[1] if len(parcalar) > 1 else item.id


def bbox_tile_kumesi(bbox: tuple[float, float, float, float]) -> set[str]:
    """BBOX'ı kesişen Sentinel-2 tile kimliklerinin kümesini döner (madde 7).

    Geniş bir tarih aralığı + gevşek bulut filtresiyle arar; amaç gerçek bir
    analiz sahnesi bulmak değil, BBOX'ın kaç farklı tile'a değdiğini görmek.
    """
    bbox_dogrula(bbox)
    adaylar = stac_ara(bbox, "2023-01-01/2023-12-31", bulut_ust_siniri=100.0)
    return {_tile_id(it) for it in adaylar}


def bbox_tile_dogrula(bbox: tuple[float, float, float, float]) -> str:
    """BBOX tek bir Sentinel-2 tile'ına düşüyor mu doğrular (madde 7).

    Geçerliyse tile kimliğini döner; birden fazla tile'a düşüyorsa
    TileSiniriAsimiHatasi fırlatır (mosaicleme YOK — madde 7).
    """
    tiles = bbox_tile_kumesi(bbox)
    if not tiles:
        raise SahneBulunamadiHatasi(
            "Bu BBOX için hiçbir Sentinel-2 tile'ı bulunamadı — alan Sentinel-2 "
            "kapsama alanı dışında olabilir."
        )
    if len(tiles) > 1:
        raise TileSiniriAsimiHatasi(
            f"Seçilen BBOX birden fazla Sentinel-2 tile'ına düşüyor: {sorted(tiles)}. "
            "Mosaicleme desteklenmiyor (madde 7) — BBOX'ı küçültün veya kaydırın."
        )
    return next(iter(tiles))


def en_iyi_sahneyi_sec(
    bbox: tuple[float, float, float, float],
    tarih: str,
    bulut_ust_siniri: float = BULUT_UST_SINIRI,
    gun_penceresi: int = GUN_PENCERESI,
):
    """Verilen tarih etrafında ±gun_penceresi gün içinde en düşük bulutlu sahneyi seçer.

    Bulunamazsa SahneBulunamadiHatasi fırlatır — sessiz boş sonuç YOK (madde 3).
    """
    aralik = _tarih_penceresi(tarih, gun_penceresi)
    adaylar = stac_ara(bbox, aralik, bulut_ust_siniri)
    if not adaylar:
        raise SahneBulunamadiHatasi(
            f"{tarih} tarihi etrafında ±{gun_penceresi} gün penceresinde, "
            f"%{bulut_ust_siniri:.0f} bulut sınırının altında uygun sahne bulunamadı."
        )
    return min(adaylar, key=lambda it: it.properties.get("eo:cloud_cover", 999))


def sahne_ciftini_sec(
    bbox: tuple[float, float, float, float],
    tarih_once: str,
    tarih_sonra: str,
    bulut_ust_siniri: float = BULUT_UST_SINIRI,
    gun_penceresi: int = GUN_PENCERESI,
):
    """İki tarih için en iyi sahne çiftini seçer (madde 3) — Paket 1.5'in ana girişi.

    Sıra: önce BBOX tek-tile mi doğrula (madde 7) → sonra her tarih için
    pencere içindeki adayları çek → aralarında ORTAK tile varsa onu tercih
    edip en düşük bulutluyu seç (madde 3: "aynı tile'ı tercih et"); ortak
    tile yoksa her tarih bağımsız en düşük bulutluyu alır (reproject_match
    Paket 2'de güvenlik ağı olarak devreye girer — bu bir hata DEĞİL).

    Dönen: (item_once, item_sonra).
    """
    bbox_tile_dogrula(bbox)

    aralik_once = _tarih_penceresi(tarih_once, gun_penceresi)
    aralik_sonra = _tarih_penceresi(tarih_sonra, gun_penceresi)

    adaylar_once = stac_ara(bbox, aralik_once, bulut_ust_siniri)
    adaylar_sonra = stac_ara(bbox, aralik_sonra, bulut_ust_siniri)

    eksik = []
    if not adaylar_once:
        eksik.append(tarih_once)
    if not adaylar_sonra:
        eksik.append(tarih_sonra)
    if eksik:
        raise SahneBulunamadiHatasi(
            f"{', '.join(eksik)} tarih(ler)i için ±{gun_penceresi} gün penceresinde, "
            f"%{bulut_ust_siniri:.0f} bulut sınırının altında uygun sahne bulunamadı."
        )

    tiles_once = {_tile_id(it) for it in adaylar_once}
    tiles_sonra = {_tile_id(it) for it in adaylar_sonra}
    ortak_tiles = tiles_once & tiles_sonra

    if ortak_tiles:
        adaylar_once = [it for it in adaylar_once if _tile_id(it) in ortak_tiles]
        adaylar_sonra = [it for it in adaylar_sonra if _tile_id(it) in ortak_tiles]

    sahne_once = min(adaylar_once, key=lambda it: it.properties.get("eo:cloud_cover", 999))
    sahne_sonra = min(adaylar_sonra, key=lambda it: it.properties.get("eo:cloud_cover", 999))
    return sahne_once, sahne_sonra
