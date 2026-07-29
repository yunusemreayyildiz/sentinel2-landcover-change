"""GDAL/rasterio icin Windows'a ozgu bir ortam duzeltmesi.

Proje yolu ASCII-disi karakter iceriyorsa (bu repo'da "Masaustu" -> 'u'),
rasterio'nun HTTPS/vsicurl istekleri icin kullandigi certifi CA bundle yolu
da o karakteri tasir. GDAL'in libcurl katmani bu yolu bir hata/uyari
mesajinda geri dondurdugunde, rasterio'nun Cython tarafi bunu UTF-8 sanip
decode etmeye calisiyor ve "UnicodeDecodeError: ... invalid start byte" ile
patliyor (yerel dosya erisimi etkilenmiyor, sadece uzak/HTTPS erisim).

Bu modul, `import rasterio` / `import odc.stac` calismadan ONCE cagrilmali;
rasterio kendi CA bundle'ini import sirasinda os.environ.setdefault ile
ayarliyor, biz once davranip ASCII bir kopyaya yonlendiriyoruz.
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path


def _ascii_degil(yol: str) -> bool:
    return any(ord(karakter) > 127 for karakter in yol)


def gdal_curl_ca_bundle_duzelt() -> None:
    import os

    if os.environ.get("GDAL_CURL_CA_BUNDLE"):
        return  # zaten ayarlanmis (ör. baska bir yerden), dokunma

    import certifi

    kaynak = certifi.where()
    if not _ascii_degil(kaynak):
        return  # bu makinede sorun yok, mudahale gerekmez

    hedef = Path(tempfile.gettempdir()) / "sentinel_backend_cacert.pem"
    if not hedef.exists():
        shutil.copyfile(kaynak, hedef)

    os.environ["GDAL_CURL_CA_BUNDLE"] = str(hedef)
    os.environ["PROJ_CURL_CA_BUNDLE"] = str(hedef)


gdal_curl_ca_bundle_duzelt()
