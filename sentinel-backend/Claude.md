# CLAUDE.md — Sentinel-2 Değişim Tespiti / Backend + Canlı Pipeline

> **Bu dosya `sentinel-backend/` köküne aittir.** Backend/pipeline bağlamını ve
> mimari kararları taşır. Frontend'in (Next.js/React/Tailwind) bununla ilgisi
> yoktur — `@AGENTS.md` importu ve frontend notları `sentinel-frontend/CLAUDE.md`
> içinde kalır. Yeni bir oturuma başlarken önce bunu oku. Teknik terimler
> İngilizce, açıklama Türkçe.

## Proje Tek Cümlede

**"İndeks üretir, CNN doğrular, LLM raporlar."** Sentinel-2 ile bi-temporal
arazi örtüsü değişim tespiti; tek karar tipi: **yapılaşma (built-up) tespiti**.
Statik hal (Arnavutköy) tamamlandı; hedef: kullanıcının BBOX + tarih çifti
seçtiği, analizi canlı çalıştıran **dinamik pipeline**.

---

## MEVCUT REPO DURUMU (ne var, ne çalışıyor)

```
sentinel-backend/            ← bu CLAUDE.md buraya
├── main.py                  ← FastAPI. /analiz ve /rapor ÇALIŞIYOR
├── data/
│   └── analiz_ozeti.json    ← statik analiz özeti (parite referansı)
├── models/
│   ├── best_effnetb0_rgb.pt          ← EuroSAT checkpoint (16.4 MB)
│   └── faz2-arnavutkoy-deg-s-m.ipynb ← ORİJİNAL Kaggle notebook — parite
│                                        sorularında BİRİNCİL kaynak, tahmin
│                                        yürütme yerine buraya bak
├── src/                     ← dinamik pipeline modülleri (Paket 1-4)
├── requirements.txt         ← geo/ML dahil güncel
└── venv/

sentinel-frontend/           ← Next.js (ayrı bağlam, ayrı CLAUDE.md)
```

- **v3 (LLM rapor) YAPILDI:** `/rapor` endpoint'i `analiz_ozeti.json`'u alıp
  **Claude Opus 4.8** ile doğal dilde kurum raporu üretiyor. Planlı değil, canlı.
- **Dinamik pipeline (Paket 1-5) YAPILDI.** `/analiz` artık iki modlu:
  parametresiz → statik Arnavutköy demo JSON'u (eski davranış, frontend
  kırılmaz); `bbox`/`tarih_once`/`tarih_sonra` query param'larıyla →
  `pipeline.analiz_calistir()` canlı çalışır. **SENKRON ve YAVAŞ** (~1-2 dk,
  STAC indirme + CNN çıkarımı) — async iş katmanı (başlat→iş no→durum) henüz
  yok, bkz. DURUM/CHECKLIST.

## DURUM / CHECKLIST

| Aşama | Durum |
|---|---|
| Statik notebook (Kaggle) v1+v2+v3 | ✅ tamam (`models/faz2-arnavutkoy-deg-s-m.ipynb`) |
| `/analiz` (statik + dinamik), `/rapor` endpoint (Claude Opus 4.8) | ✅ çalışıyor |
| Paket 1 — STAC/BBOX çekme (`stac_fetch.py`) | ✅ tamam |
| Paket 1.5 — sahne seçim politikası (`scene_selection.py`) | ✅ tamam |
| Paket 2 — ön işleme (`preprocess.py`) | ✅ tamam |
| Paket 3 — in-memory v1 (`v1_candidates.py`) | ✅ tamam (parite: 2584/2914ha birebir) |
| Paket 4 — in-memory v2 + istatistik eşleme (`v2_validate.py`) | ✅ tamam (parite: ±%5 tolerans içinde) |
| Paket 5 — orchestrator (`pipeline.py`) + parite testi (`tests/test_parity.py`) | ✅ tamam (4/4 test geçti) |
| Paket 5 — edge case testleri (`tests/test_edge_cases.py`) | ✅ tamam (7/7 test geçti) |
| Async job katmanı (başlat→iş no→durum) | ⏳ sonraki faz |
| geo/ML bağımlılıkları (`requirements.txt`) | ✅ eklendi |

---

## Mimari (üç katman)

1. **v1 — indeks tabanlı aday üretimi (model YOK):** dNDVI + dNDBI çift koşullu
   eşikleme, SCL maskeleri, alan filtresi, vektörleştirme.
2. **v2 — CNN doğrulama:** EuroSAT'ta eğitilmiş EfficientNet-B0, aday
   poligonlardan kesilen 64×64 patch'leri sınıflandırıp yanlış alarmları eler.
   **DL burada dedektör DEĞİL, filtre.** Asla değişim önermez; yalnızca v1'in
   bulduğu adayları onaylar/eler.
3. **v3 — LLM rapor katmanı ✅:** Görüntüye dokunmaz; `analiz_ozeti.json`'dan
   Claude Opus 4.8 ile doğal dilde kurum raporu üretir (`/rapor`).

---

## DONDURULMUŞ KARARLAR (değiştirmeden önce tartış)

Bu kararlar dinamikleştirme yol haritası tartışmasında gerekçeleriyle alındı.
Bir tanesini değiştirmek istiyorsan önce gerekçeyi çürüt.

### 1. Bant listesi: `B02, B03, B04, B08, B11, SCL`
- B04/B03/B02 (red/green/blue) → **v2 RGB patch'leri için zorunlu**
- B08 (nir) → NDVI + NDBI
- B11 (swir16) → NDBI
- **SCL → bulut/gölge/geçerlilik maskesi (zorunlu, lüks değil)**
- ⚠️ B02+B03 olmadan v2 çalışmaz. SCL olmadan bulutlu tarih edge-case'i
  maskelenemez.

### 2. Tarihler-arası histogram eşleme YOK
- Global histogram eşleme, tespit etmeye çalıştığın **değişim sinyalini
  normalize edip yok eder.** Klasik change-detection tuzağı.
- Karşılaştırılabilirlik şununla sağlanır: **aynı tile + aynı mevsim + aynı
  uydu (S2A) + L2A BOA**. Radyometrik düzeltmeye gerek yok.
- İleride gerçekten gerekirse çözüm global histogram DEĞİL,
  **PIF (pseudo-invariant feature) tabanlı göreli normalizasyon**.
- ⚠️ KARIŞTIRMA: v2'deki `patch → EuroSAT` istatistik eşlemesi (madde 5)
  bambaşka bir şeydir ve KALIR.

### 3. Sahne seçimi = AYRI iş paketi (Paket 1.5)
Paket 1'in içine gömme. Politika:
- `eo:cloud_cover < %10` filtresi
- istenen tarihin **±15-20 gün** penceresinde arama. Dar pencere (ör. ±7 gün)
  "mevsim + düşük bulut" ikilisini aynı anda tutturamayabilir (İstanbul gibi
  nemli iklimlerde); madde 4'teki Haziran-Eylül mevsim kısıtı zaten üst sınırı
  koruduğu için pencere geniş tutulabilir.
- **aynı tile'ı tercih et** (→ `reproject_match` güvenlik ağı olur, koltuk
  değneği değil)
- her tarihte en düşük bulutluyu seç
- iki tarihte de uygun sahne yoksa → **anlamlı hata dön** (sessiz boş sonuç
  DEĞİL)

### 4. Mevsim kısıtı: her iki tarih de Haziran–Eylül
- Eşikler (`dNDVI < -0.15 & dNDBI > 0.20`) **temmuz-temmuz üzerinde kalibre
  edildi.** Mevsim kayarsa vejetasyon farkı **sahte yapılaşma** üretir.
  ⚠️ Bu eşik `models/faz2-arnavutkoy-deg-s-m.ipynb` hücre `d8d573be`'den
  alındı (-0.10/-0.15/-0.20/-0.25 NDVI x 0.15/0.20/0.25 NDBI tarandı,
  -0.15/0.20 seçildi) — bir süre burada yanlışlıkla **-0.30** yazıyordu,
  bu Paket 3'te fark edilip düzeltildi. Sayı uyuşmazlığı görürsen ÖNCE
  notebook'a bak, CLAUDE.md'ye değil.
- İlk sürüm: iki tarihi de aynı mevsim penceresine zorla, **arayüzde açıkça
  söyle.** Tarih-çiftine göre yeniden kalibrasyona ilk sürümde girme.

### 5. Domain-shift düzeltmesi v2'de ZORUNLU
- Patch ön işleme sırası: RGB `[3,2,1]` → `/10000` → `clip(0,1)` →
  **doğrusal istatistik eşleme** → model
- ⚠️ **Bilinen ama BİLEREK KORUNAN eksiklik:** Gerçek reflectans
  `DN×scale+offset` (STAC `raster:bands` metadata, tipik `scale=0.0001,
  offset=-0.1`) ile hesaplanır; `/10000` bu offset'i (ESA baseline ≥04.00
  ile eklenen +1000 DN) yok sayar. **Orijinal notebook da bunu yapmıyor**
  (hücre `495e5a83`'te `boa_offset_applied: True` fark edilip not
  düşülmüş ama düzeltilmemiş) — "SeaLake patlaması" ve onu telafi eden bu
  istatistik-eşleme adımının asıl kök nedeni muhtemelen budur. Parite için
  dinamik pipeline de AYNI şekilde `/10000` kullanıyor (bkz.
  `stac_fetch.bantlari_yukle` docstring'i). Doğru offset düzeltmesi
  gelecekte bilinçli bir iyileştirme olarak ele alınabilir ama önce Paket 5
  parite testi geçmeli — düzeltme parite sayılarını değiştirir.
- Bu offset sorunu **v1'i de etkiler** (dNDVI/dNDBI hesabı da ham DN
  kullanıyor, `v1_candidates.py`) — aynı gerekçeyle bilerek düzeltilmedi.
- EuroSAT hedef istatistikleri:
  - `mean = [0.0946, 0.1041, 0.1117]`
  - `std  = [0.0596, 0.0397, 0.0333]`
- ⚠️ Atlanırsa "SeaLake patlaması" geri gelir (yanlış sınıflandırma).
  Bu, projenin en güçlü teknik hikâyesinin (TOA/BOA dağılım farkı) çözümü.
- ⚠️ **Bu ofset sorunu v1'i de etkiler** — dNDVI/dNDBI eşikleri de reflectans
  üzerinden hesaplanmalı (offset payda'da sadeleşmiyor). `v1_candidates.py`
  girdisi olarak `bantlari_yukle()`'nin ürettiği reflectans verisini kullanır.

### 6. BBOX alan limiti: 750 km²
- Referans Arnavutköy BBOX'ı zaten ~697 km² ve in-memory v1/v2 mimarisinde
  (6 bant × 2 tarih, float32, ara hesaplar dahil) yaklaşık 1 GB peak bellek
  kullanıyor. Limit bunun hemen üstünde tutuluyor ki referans senaryo
  kırılmasın ama kullanıcı sınırsız büyük bir alan seçip sunucuyu OOM'a
  sürükleyemesin.
- **Hesap yöntemi:** derece bazlı `(lon2-lon1)*(lat2-lat1)` DEĞİL — enlem
  arttıkça 1° boylamın km karşılığı küçülür. `pyproj.Geod.geometry_area_perimeter`
  ile gerçek geodezik alan hesapla.
- Aşılırsa **anlamlı hata dön**: "BBOX alanı X km², izin verilen üst sınır
  750 km²." (madde 3'teki sessiz-boş-sonuç-yasağı felsefesiyle tutarlı)

### 7. Tile sınırı aşımı: mosaicleme YOK, anlamlı hata dön
- 750 km² üst sınır, tek bir Sentinel-2 tile'ının (100×100 km = 10.000 km²)
  küçük bir kesri — çoğu BBOX seçimi zaten tek tile içinde kalır. Sorun
  sadece kullanıcı tam tile sınırına denk gelen bir BBOX çizerse çıkar.
- Komşu tile'ları reprojeksiyonla birleştirmek (mosaicleme) teknik olarak
  mümkün ama kapsam sınırları felsefesiyle ("site/mahalle ölçeğinde
  dürüstlük") çelişir: ek karmaşıklık katar ve parite testini bulanıklaştırır
  (artık "hangi tile'dan geldi" belirsizleşir).
- Paket 1.5'te BBOX'ın tek bir Sentinel-2 tile grid hücresine düştüğünü
  doğrula; düşmüyorsa "Seçilen alan tile sınırını aşıyor, BBOX'ı küçültün
  veya kaydırın" gibi net bir hata dön. Mosaicleme, gerçek talep gelirse
  ayrı bir faz olarak ele alınabilir.

---

## PARİTE TESTİ (Paket 5'in İLK maddesi — atlanamaz)

⚠️ **Parite testi `scene_selection.py`'yi ATLAR.** Paket 1.5'te sahne seçimi
"pencere içinde en düşük bulutluyu seç" politikasıyla çalışıyor (madde 3);
bu, kullanıcı tam olarak statik referans tarihlerini (`2018-07-04`,
`2025-07-09`) girse bile ±15-20 gün penceresinde daha düşük bulutlu başka
bir sahne varsa (test: `2025-07-09` yerine `2025-07-22`, bulut %0.003 <
%0.008) **farklı bir sahne** seçebileceği anlamına gelir. Bu davranış
politika olarak DOĞRU (madde 3'ün amacı bu) ama parite testini
bulanıklaştırır.
- **Çözüm:** `pipeline.py`, sahne seçimini pipeline'ın geri kalanından
  ayıran iki katman sunmalı:
  - `analiz_calistir(bbox, tarih_once, tarih_sonra, ...)` — kullanıcı akışı,
    içeride `scene_selection.sahne_ciftini_sec()` çağırır.
  - `analiz_calistir_sahnelerle(item_once, item_sonra, bbox, ...)` — sahne
    seçimini ATLAYIP doğrudan verilen iki STAC Item ile çalışır.
- Parite testi (`tests/test_parity.py`) **ikinci** fonksiyonu, statik
  referansın tam bildiği sahne ID'leriyle (`S2A_35TPF_20180704_1_L2A` /
  referans `S2A_35TPF_20250709` sahnesi) çağırır. Böylece "refactor mı
  bozdu, sahne seçim politikası mı farklı sahne seçti" ayrımı baştan nettir.

Paket 1–4 bitince, `analiz_calistir_sahnelerle()` fonksiyonunu **statik
Arnavutköy referans sahneleriyle** çağır ve şu sonuçları **birebir** üret
(kaynak: `data/analiz_ozeti.json`):

| Metrik | Beklenen | Tolerans |
|---|---|---|
| Aday poligon (v1) | **2.584** (2.914 ha) | **TAM eşleşme zorunlu** |
| Doğrulanamadı (kenar) | **133** | **TAM eşleşme zorunlu** |
| Onaylandı (v2) | **1.227** (1.143 ha) | ±%5 kabul edilir |
| Elendi | **1.224** | ±%5 kabul edilir |
| Sınıf dağılımı | Highway 674 / Industrial 394 / Residential 159 | serbest (bkz. not) |

⚠️ **v1 ile v2 için tolerans farklı — bilerek.** v1 (aday poligon sayısı/alanı)
ve "doğrulanamadı" (kenar-patch mantığı) tamamen deterministik hesaplardır —
bunlar **BİREBİR** tutmalı; tutmuyorsa gerçek bir kod hatası vardır.
`Paket 3`'te bu gerçekten doğrulandı: 2.584/2.914 ha/320.977 piksel notebook'la
birebir eşleşti (kök neden CLAUDE.md'deki yanlış eşik değeriydi, bkz. madde 4).

v2 (CNN sınıflandırma) ise **PyTorch/timm'in ortamlar arası bit-birebir
tekrarlanabilirliğine** dayanıyor — bu genelde garanti edilemez (farklı
torch/timm sürümü, CPU BLAS/kernel farkı, vb. küçük sayısal farklar borderline
softmax kararlarını kaydırabilir). Gerçek ölçüm: aynı checkpoint + aynı
patch'lerle onaylandı=1241 (referans 1.227, ~%1 fark), ama sınıf içi dağılım
Highway/Industrial arasında ~130 poligonluk bir kayma gösterdi — kod mantığı
DOĞRU (patch çıkarma, istatistik eşleme, eleme kuralı hepsi doğrulandı),
sapma sinir ağının kendisinden. Bu yüzden v2 sayıları için ±%5 tolerans kabul
edilir; sınıf dağılımı (Highway/Industrial/Residential kırılımı) serbest
bırakılır, sadece TOPLAM onaylı+elendi+doğrulanamadı üçlüsü tutarlı olmalı.

**v1/kenar tutmadan yeni bölgeye güvenme.** Tutmazsa, her hatayı "refactor mı
bozdu, yeni bölge mi zorladı" diye ayıramazsın. v1 parite = refactor'ın kabul
kriteri; v2 toleranslı parite ek bir sağlık kontrolüdür.

---

## STATİK REFERANS PARAMETRELERİ (parite testi girdisi)

- **AOI:** Arnavutköy / İGA çevresi, bbox `[28.60, 41.10, 28.90, 41.35]` (WGS84)
- **Dönem:** 2018-07-04 → 2025-07-09
- **Sahne çifti:** `S2A_35TPF_20180704` / `S2A_35TPF_20250709` (tile 35TPF,
  ikisi de %0 bulut, ikisi de S2A, temmuz)
- **STAC:** Element84 Earth Search, koleksiyon `sentinel-2-l2a` (hesapsız COG)
- **Yükleme:** odc-stac, 10 m, EPSG:32635
- **İndeksler:** `NDVI=(nir-red)/(nir+red)`, `NDBI=(swir16-nir)/(swir16+nir)`;
  fark = 2025 − 2018
- **Maskeler:** SCL geçerlilik (sınıf 4,5,6,7 her iki tarihte) + su dışlama
  (SCL sınıf 6 herhangi bir tarihte)
- **Eşik:** `dNDVI < -0.15 & dNDBI > 0.20` (bkz. madde 4 — notebook'ta
  taranıp seçildi, CLAUDE.md'de bir süre yanlışlıkla -0.30 yazıyordu)
- **Vektörleştirme:** `scipy.ndimage.label` + min 10 px (0.1 ha) +
  `rasterio.features` → GeoPandas
- **Merkez:** `representative_point` (**centroid DEĞİL** — concave poligonda
  centroid dışarı düşer)
- **Affine:** `Affine(10, 0, x0-5, 0, -10, y0+5)` — piksel merkez→köşe ±5 kayması
- **Eleme kuralı:** `sinif ∈ {Industrial, Residential, Highway}` VE `guven ≥ 0.5`
  → onaylandi. ⚠️ Boş sınıf string `"nan"` olabilir — `isna()` yetmez,
  `astype(str)=="nan"` de gerekli.

### Model
- **EfficientNet-B0** (timm, ImageNet ön-eğitimli), checkpoint
  `models/best_effnetb0_rgb.pt` (16.4 MB)
- Local'de `map_location="cpu"` ile yükle (GPU şart değil, patch başına ms)
- **EuroSAT sınıfları:** AnnualCrop, Forest, HerbaceousVegetation, Highway,
  Industrial, Pasture, PermanentCrop, Residential, River, SeaLake

---

## REVİZE İŞ PAKETLERİ

| # | Paket | İçerik |
|---|---|---|
| 1 | STAC & BBOX veri çekme | pystac-client arama, BBOX alan kısıtı **750 km²** (madde 6, `pyproj.Geod`), rioxarray/odc-stac ile bant streaming. **6 bant (madde 1).** |
| 1.5 | **Sahne seçim politikası** [yeni] | Bulut filtresi, **±15-20 gün** tarih penceresi (madde 3), tile tercihi, **tek-tile doğrulaması** (madde 7), hata yönetimi. İzole test et. |
| 2 | Ön işleme | reproject_match (güvenlik ağı), **SCL maskesi**. Histogram eşleme YOK (madde 2). |
| 3 | In-memory v1 | dNDVI/dNDBI, threshold, raster→polygon, alan filtresi. Mevsim kısıtı (madde 4). |
| 4 | In-memory v2 + model | 64×64 patch, **zorunlu istatistik eşleme** (madde 5), batch tahmin. |
| 5 | **Parite testi** + edge cases | Önce parite (yukarı), sonra: boş BBOX, bulutlu tarih, kenar taşması, tek-tile aşımı. |

**Bu 5 paket boru hattı çekirdeğidir.** Async API katmanı (başlat → iş no →
durum sorgula) DAHİL DEĞİL — sonraki faz. Gerçekçi süre: ~2–2,5 hafta
(web/async entegrasyonu dahil ~3–3,5 hafta).

---

## KAPSAM SINIRLARI (ölçek dürüstlüğü)

- Sistem **site/mahalle** ölçeğinde çalışır (10 m çözünürlük).
- **Tekil bina iddiası YOK.** Min poligon 0.1 ha.
- **"doğrulanamadı" kategorisi korunur** — dürüstlük göstergesi, gizlenmez.
- Sunum dili: "Copernicus programı verisi, Earth Search dağıtımı".

---

## LOCAL ORTAM

Mevcut `sentinel-backend/venv/` FastAPI + anthropic ile çalışıyor. Geo/ML
bağımlılıklarını buraya ekle:

```
# önce mevcut venv'e pip ile dene — rasterio/geopandas artık Windows wheel'i
# ile geliyor, odc-stac saf Python, torch'un wheel'i var:
pip install rasterio geopandas rioxarray odc-stac pystac-client scipy torch timm
```

- pip kurulumu GDAL yüzünden patlarsa → **conda-forge** ile ayrı ortam veya
  **WSL2** içinde Linux gibi çalış.
- Kurulan paketleri `requirements.txt`'e işle (şu an eksik).
- Model checkpoint zaten `models/best_effnetb0_rgb.pt`'de.

### ⚠️ Bilinen ortam sorunu: proje yolu ASCII-dışı karakter içeriyor
Repo `OneDrive\Masaüstü\...` altında ('ü' karakteri). Bu, rasterio'nun
HTTPS/vsicurl (uzak COG) erişiminde şu hatayı verir: `UnicodeDecodeError:
'utf-8' codec can't decode byte 0xfc ... invalid start byte`. **Yerel dosya
erişimi etkilenmez, sadece uzak erişim patlar.**
- **Kök neden:** rasterio, GDAL'ın libcurl katmanına CA sertifika paketi
  olarak `certifi.where()` yolunu veriyor (`GDAL_CURL_CA_BUNDLE`). Bu yol da
  venv'in altında olduğu için 'ü' içeriyor; GDAL bir hata/uyarı mesajında bu
  yolu geri döndürünce rasterio'nun Cython tarafı UTF-8 decode etmeye
  çalışıp patlıyor.
- **Çözüm uygulandı:** `src/_gis_env.py` — `certifi`'nin cacert.pem'ini ASCII
  bir geçici klasöre (`tempfile.gettempdir()`) kopyalayıp
  `GDAL_CURL_CA_BUNDLE`/`PROJ_CURL_CA_BUNDLE`'ı oraya yönlendiriyor.
  `stac_fetch.py`'ın en başında, `rasterio`/`odc.stac` import edilmeden ÖNCE
  çalışır (`from src import _gis_env`).
- GDAL_DATA/PROJ_DATA'yı ASCII yola taşımaya GEREK YOK — test edildi, sadece
  CA bundle sorunluydu.
- Yeni bir modül rasterio/odc-stac/pyproj'u ilk kez import ediyorsa, bu
  import'un `_gis_env` import'undan SONRA gelmesini sağla (main.py pipeline
  modüllerini import ettiğinde zincirleme çalışır, ayrıca tetiklemeye gerek
  yok — ama doğrudan bir script yazıyorsan unutma).

### Migration sırası (kritik)
1. geo/ML bağımlılıklarını kur
2. **Statik Arnavutköy parametreleriyle** notebook mantığını local'de bire bir
   çalıştır → parite testini geçir
3. **Sonra** dinamik parametreleri açan refactor'a geç
> Böylece "local'e taşırken mi bozuldu, dinamikleştirirken mi bozuldu"
> ayrımını baştan garantilersin.

---

## PROJE YAPISI (mevcut `sentinel-backend/` İÇİNE kurulur)

Yeni bir kök klasör açma. Pipeline modülleri mevcut backend'in içine girer;
`main.py` API girişi olarak yerinde kalır.

```
sentinel-backend/
├── CLAUDE.md                  # bu dosya
├── main.py                    # FastAPI — /analiz, /rapor (kalır; pipeline'ı çağırır)
├── requirements.txt           # geo/ML deps eklenecek
├── data/
│   └── analiz_ozeti.json       # statik referans / parite kaynağı
├── models/
│   └── best_effnetb0_rgb.pt
├── src/                       # [YENİ] pipeline modülleri
│   ├── stac_fetch.py          # Paket 1
│   ├── scene_selection.py     # Paket 1.5
│   ├── preprocess.py          # Paket 2 (SCL maske, reproject_match)
│   ├── v1_candidates.py       # Paket 3
│   ├── v2_validate.py         # Paket 4 (patch, istatistik eşleme, tahmin)
│   └── pipeline.py            # analiz_calistir() orchestrator
└── tests/                     # [YENİ]
    └── test_parity.py         # Paket 5 — Arnavutköy parite testi
```

Çekirdek sözleşme (iki katman — bkz. PARİTE TESTİ bölümü, madde: neden ayrık):
```python
# src/pipeline.py
def analiz_calistir(bbox, tarih_once, tarih_sonra, ...) -> dict:
    """Kullanıcı akışı. scene_selection.sahne_ciftini_sec() ile sahneleri
    seçer, sonra analiz_calistir_sahnelerle()'ye devreder.
    main.py bunu import edip /analiz içinde çağırır; /rapor bu dict'i
    Claude Opus 4.8'e verir."""

def analiz_calistir_sahnelerle(item_once, item_sonra, bbox, ...) -> dict:
    """Kaggle notebook mantığının parametreli hali — sahne seçimini
    ATLAYIP doğrudan verilen iki STAC Item ile çalışır.
    Dönüş: analiz_ozeti.json şemasıyla aynı dict.
    Parite testi (tests/test_parity.py) BU fonksiyonu, statik referans
    sahneleriyle doğrudan çağırır — sahne seçim politikasının farklı bir
    sahne seçmesi parite sonucunu etkilemesin diye."""
```