import json
import os
from pathlib import Path
from uuid import uuid4

import anthropic
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.pipeline import analiz_calistir, analiz_calistir_sahnelerle
from src.scene_selection import SahneBulunamadiHatasi, TileSiniriAsimiHatasi, sahne_ciftini_sec
from src.stac_fetch import BboxHatasi
from src.v1_candidates import MevsimHatasi

load_dotenv()

app = FastAPI(title="Sentinel-2 Değişim Analizi API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

VERI_KLASORU = Path(__file__).parent / "data"
MODEL_CHECKPOINT = str(Path(__file__).parent / "models" / "best_effnetb0_rgb.pt")
CLAUDE_MODEL = "claude-opus-4-8"

# Async iş katmanı (başlat → iş no → durum sorgula, bkz. CLAUDE.md "sonraki faz").
# Bellek içi iş deposu: tek-worker geliştirme sunucusu için yeterli, çoklu worker/
# restart arası kalıcılık gerekmiyor (iş durumu yalnızca bir analiz oturumu boyunca anlamlı).
isler: dict[str, dict] = {}


class AnalizIstegi(BaseModel):
    bbox: list[float]
    tarih_once: str
    tarih_sonra: str


def _analiz_isini_yurut(
    is_no: str, bbox: tuple[float, float, float, float], tarih_once: str, tarih_sonra: str
) -> None:
    """BackgroundTasks içinde çalışır — yanıt döndükten SONRA başlar.

    İki aşama raporlanır (sahne_araniyor / goruntu_indiriliyor): sahne seçimi
    (canlı STAC katalog araması) ayrı, gerçekten ölçülebilir bir adım; geri kalan
    indirme+indeks+CNN `analiz_calistir_sahnelerle` içinde tek bloktan geçtiği için
    ayrıştırılamıyor — sahte ara-aşama uydurmak yerine tek adım olarak bırakıldı.
    """
    try:
        isler[is_no] = {"durum": "calisiyor", "asama": "sahne_araniyor", "ilerleme": 10}
        item_once, item_sonra = sahne_ciftini_sec(bbox, tarih_once, tarih_sonra)

        isler[is_no] = {"durum": "calisiyor", "asama": "goruntu_indiriliyor", "ilerleme": 40}
        sonuc = analiz_calistir_sahnelerle(
            item_once, item_sonra, bbox, tarih_once, tarih_sonra, MODEL_CHECKPOINT
        )
        isler[is_no] = {"durum": "bitti", "asama": "tamamlandi", "ilerleme": 100, "sonuc": sonuc}
    except (BboxHatasi, MevsimHatasi, SahneBulunamadiHatasi, TileSiniriAsimiHatasi) as e:
        isler[is_no] = {"durum": "hata", "hata": str(e)}
    except Exception as e:
        isler[is_no] = {"durum": "hata", "hata": f"Beklenmeyen hata: {e}"}

RAPOR_SISTEM_PROMPTU = """Sen bir GIS analiz kurumunda çalışan teknik rapor yazarısın. Sana JSON formatında \
bir uydu görüntüsü değişim analizi özeti verilecek. Bu özetten karar vericilere yönelik resmi, kurumsal \
dilde bir Türkçe rapor yaz.

Rapor şu bölümleri içermeli:
1. Çalışma alanı ve dönem
2. Kullanılan yöntem (indeks tabanlı aday üretimi + CNN doğrulama, kısaca)
3. Sonuçlar (huni istatistiği, onaylı/elenen/doğrulanamayan sayılar, onaylı alan)
4. Sınıf dağılımı ve öne çıkan poligonlar
5. Kısa değerlendirme

Veri kaynağını "Copernicus programı verisi, Earth Search dağıtımı" olarak belirt. "Doğrulanamadı" kategorisini \
gizlemek yerine bir belirsizlik/dürüstlük göstergesi olarak sun. JSON'da olmayan sayı veya iddia üretme."""


def json_dosyasi_oku(dosya_adi: str):
    yol = VERI_KLASORU / dosya_adi
    if not yol.exists():
        raise HTTPException(
            status_code=404,
            detail=f"{dosya_adi} dosyası bulunamadı.",
        )
    with open(yol, encoding="utf-8") as f:
        return json.load(f)


@app.get("/")
def ana_sayfa():
    return {"status": "calisiyor", "proje": "Sentinel-2 Arazi Örtüsü Değişim Tespiti"}


@app.get("/analiz")
def analiz_ozeti(
    bbox: str | None = None,
    tarih_once: str | None = None,
    tarih_sonra: str | None = None,
):
    """Parametre verilmezse statik Arnavutköy demo özetini döner (eski davranış,
    frontend'i kırmaz). Üçü de verilirse dinamik pipeline'ı (Paket 1-5) canlı
    çalıştırır — bu SENKRON ve YAVAŞTIR (STAC indirme + CNN çıkarımı ~1-2 dk
    sürebilir); async iş katmanı henüz yok (bkz. CLAUDE.md sonraki faz)."""
    parametreler = (bbox, tarih_once, tarih_sonra)
    if all(p is None for p in parametreler):
        return json_dosyasi_oku("analiz_ozeti.json")

    if any(p is None for p in parametreler):
        raise HTTPException(
            status_code=400,
            detail="bbox, tarih_once ve tarih_sonra parametrelerinin ÜÇÜ birden "
            "verilmesi gerekir (ya da statik demo için hiçbiri).",
        )

    try:
        bbox_degerleri = [float(x) for x in bbox.split(",")]
        if len(bbox_degerleri) != 4:
            raise ValueError
        bbox_tuple = tuple(bbox_degerleri)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="bbox 'min_lon,min_lat,max_lon,max_lat' formatında 4 sayı olmalı.",
        )

    try:
        return analiz_calistir(bbox_tuple, tarih_once, tarih_sonra, MODEL_CHECKPOINT)
    except (BboxHatasi, MevsimHatasi) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (SahneBulunamadiHatasi, TileSiniriAsimiHatasi) as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/analiz")
def analiz_baslat(istek: AnalizIstegi, arka_plan: BackgroundTasks):
    """Analizi arka planda başlatır, hemen bir iş no döner (senkron GET /analiz'in
    aksine tarayıcıyı 1-2 dk açık tutmaz). İlerleme/sonuç için bkz. GET /analiz/{is_no}/durum."""
    if len(istek.bbox) != 4:
        raise HTTPException(
            status_code=400,
            detail="bbox 4 sayı olmalı: [min_lon, min_lat, max_lon, max_lat].",
        )
    bbox_tuple = tuple(istek.bbox)
    is_no = uuid4().hex
    isler[is_no] = {"durum": "calisiyor", "asama": "sahne_araniyor", "ilerleme": 0}
    arka_plan.add_task(_analiz_isini_yurut, is_no, bbox_tuple, istek.tarih_once, istek.tarih_sonra)
    return {"isNo": is_no}


@app.get("/analiz/{is_no}/durum")
def analiz_durum(is_no: str):
    is_kaydi = isler.get(is_no)
    if is_kaydi is None:
        raise HTTPException(status_code=404, detail=f"Bilinmeyen iş no: {is_no}")
    return is_kaydi


@app.get("/geojson")
def degisim_geojson():
    return json_dosyasi_oku("degisim_analizi.geojson")


@app.get("/rapor")
def rapor_uret(is_no: str | None = None):
    """is_no verilmezse statik Arnavutköy demo özetini raporlar (eski davranış).
    Verilirse ilgili dinamik işin sonucunu raporlar — iş bitmemişse/hataysa
    anlamlı hata döner (sessizce statik demoya düşmez)."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY ortam değişkeni ayarlı değil. "
            "Terminali durdurup (Ctrl+C) anahtarı ayarlayıp uvicorn'u yeniden başlat.",
        )

    if is_no is not None:
        is_kaydi = isler.get(is_no)
        if is_kaydi is None:
            raise HTTPException(status_code=404, detail=f"Bilinmeyen iş no: {is_no}")
        if is_kaydi["durum"] != "bitti":
            raise HTTPException(
                status_code=409,
                detail=f"Analiz henüz tamamlanmadı (durum: {is_kaydi['durum']}).",
            )
        ozet = is_kaydi["sonuc"]
    else:
        ozet = json_dosyasi_oku("analiz_ozeti.json")

    # geojson (varsa) rapor girdisinden çıkarılır -- LLM için gereksiz, yüzlerce
    # KB koordinat token'ı israf eder; rapor yalnızca sayısal özete bakar.
    rapor_girdisi = {k: v for k, v in ozet.items() if k != "geojson"}
    client = anthropic.Anthropic()

    try:
        mesaj = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=RAPOR_SISTEM_PROMPTU,
            messages=[
                {
                    "role": "user",
                    "content": f"Analiz özeti:\n\n{json.dumps(rapor_girdisi, ensure_ascii=False, indent=2)}",
                }
            ],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY geçersiz.",
        )
    except anthropic.APIStatusError as e:
        if e.status_code == 400 and "credit balance" in e.message.lower():
            detay = "Anthropic hesap bakiyesi yetersiz. console.anthropic.com/settings/billing üzerinden kredi ekle."
        else:
            detay = f"Anthropic API hatası ({e.status_code}): {e.message}"
        raise HTTPException(status_code=502, detail=detay)
    except anthropic.APIConnectionError:
        raise HTTPException(
            status_code=502,
            detail="Anthropic API'ye ağ bağlantısı kurulamadı.",
        )

    rapor_metni = next((b.text for b in mesaj.content if b.type == "text"), "")
    return {
        "rapor": rapor_metni,
        "kullanim": {
            "girdi_token": mesaj.usage.input_tokens,
            "cikti_token": mesaj.usage.output_tokens,
        },
    }
