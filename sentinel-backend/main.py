import json
import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="Sentinel-2 Değişim Analizi API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

VERI_KLASORU = Path(__file__).parent / "data"
CLAUDE_MODEL = "claude-opus-4-8"

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
    return {"durum": "calisiyor", "proje": "Sentinel-2 Arazi Örtüsü Değişim Tespiti"}


@app.get("/analiz")
def analiz_ozeti():
    return json_dosyasi_oku("analiz_ozeti.json")


@app.get("/geojson")
def degisim_geojson():
    return json_dosyasi_oku("degisim_analizi.geojson")


@app.get("/rapor")
def rapor_uret():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY ortam değişkeni ayarlı değil. "
            "Terminali durdurup (Ctrl+C) anahtarı ayarlayıp uvicorn'u yeniden başlat.",
        )

    ozet = json_dosyasi_oku("analiz_ozeti.json")
    client = anthropic.Anthropic()

    try:
        mesaj = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=RAPOR_SISTEM_PROMPTU,
            messages=[
                {
                    "role": "user",
                    "content": f"Analiz özeti:\n\n{json.dumps(ozet, ensure_ascii=False, indent=2)}",
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
