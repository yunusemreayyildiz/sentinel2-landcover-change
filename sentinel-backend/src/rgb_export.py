"""Perde (swipe) karşılaştırması için before/after Sentinel-2 gerçek renk PNG
önizlemesi üretir (sentinel-frontend/CLAUDE.md dondurulmuş karar madde 3).

Yalnızca GÖRSELLEŞTİRME amaçlıdır — analiz (v1/v2) ham DN/reflectans üzerinden
çalışmaya devam eder, bu modül ona dokunmaz.
"""

from __future__ import annotations

import io

import numpy as np
import xarray as xr
from PIL import Image

WEB_MAX_BOYUT = 1024


def rgb_onizleme_png(ds: xr.Dataset) -> bytes:
    """ds'nin red/green/blue bantlarından web'e uygun 8-bit RGB PNG üretir.

    Ham DN görüntülemede çok karanlık/düşük kontrastlı görünür; %2-%98
    persentil germe (stretch) ile kontrast ayarlanır — bu ölçek/ofset
    farkından bağımsızdır, madde 5'teki bilinen +1000 DN ofset sorunundan
    etkilenmez. Web boyutuna küçültme (en uzun kenar WEB_MAX_BOYUT px)
    payload'ı küçük tutar.
    """
    rgb = np.stack(
        [ds["red"].values, ds["green"].values, ds["blue"].values], axis=-1
    ).astype("float32")

    alt, ust = np.nanpercentile(rgb, [2, 98])
    gerilmis = np.clip((rgb - alt) / (ust - alt + 1e-6), 0, 1)
    sekiz_bit = np.nan_to_num(gerilmis * 255).round().astype("uint8")

    goruntu = Image.fromarray(sekiz_bit, mode="RGB")
    if max(goruntu.size) > WEB_MAX_BOYUT:
        oran = WEB_MAX_BOYUT / max(goruntu.size)
        yeni_boyut = (round(goruntu.width * oran), round(goruntu.height * oran))
        goruntu = goruntu.resize(yeni_boyut, Image.BILINEAR)

    arabellek = io.BytesIO()
    goruntu.save(arabellek, format="PNG")
    return arabellek.getvalue()
