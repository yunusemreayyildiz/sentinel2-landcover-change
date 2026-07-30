export const API_TABAN_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type DegisimDurumu = "onaylandi" | "elendi" | "dogrulanamadi";

export interface DegisimOzellikleri {
  deger: number;
  alan_ha: number;
  merkez_x: number;
  merkez_y: number;
  sinif: string;
  guven: number;
  durum: DegisimDurumu;
}

export interface DegisimGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: DegisimOzellikleri;
    geometry: { type: string; coordinates: unknown };
  }>;
}

export async function degisimGeojsonGetir(): Promise<DegisimGeoJSON> {
  const yanit = await fetch(`${API_TABAN_URL}/geojson`, { cache: "no-store" });
  if (!yanit.ok) {
    throw new Error(`/geojson isteği başarısız: ${yanit.status}`);
  }
  return yanit.json();
}

export interface AnalizOzeti {
  proje: string;
  aoi: { ad: string; bbox: number[]; crs: string };
  sahneler: { once: string; sonra: string; tile: string };
  yontem: {
    v1: string;
    v2: string;
    huni_yuzde: number[];
    cnn_onay: { poligon_orani: number; alan_orani: number };
  };
  sonuclar: {
    aday_poligon: number;
    onaylandi: number;
    elendi: number;
    dogrulanamadi: number;
    onayli_alan_ha: number;
    sinif_dagilimi: Record<string, number>;
    en_buyuk_10: Array<{
      alan_ha: number;
      sinif: string;
      guven: number;
      merkez_lat: number;
      merkez_lon: number;
    }>;
  };
  // Yalnizca dinamik (bbox/tarih parametreli) calistirmada dolu gelir
  // (sentinel-backend/src/pipeline.py _geojson_uret) -- statik demo JSON'da yok,
  // o yol hala ayri /geojson uzerinden gider (bkz. degisimGeojsonGetir).
  geojson?: DegisimGeoJSON;
}

export async function analizOzetiGetir(): Promise<AnalizOzeti> {
  const yanit = await fetch(`${API_TABAN_URL}/analiz`, { cache: "no-store" });
  if (!yanit.ok) {
    throw new Error(`/analiz isteği başarısız: ${yanit.status}`);
  }
  return yanit.json();
}

// --- Async analiz akışı (job + polling) ---
//
// Backend'de POST /analiz (iş no döner) ve GET /analiz/{id}/durum artık VAR
// (main.py — BackgroundTasks + bellek içi iş deposu). Varsayılan olarak gerçek
// bu uç noktalar kullanılır. NEXT_PUBLIC_MOCK_ANALIZ=true yalnızca backend
// ayakta değilken frontend'i tek başına geliştirmek için bir kaçış yoludur.
const MOCK_ANALIZ = process.env.NEXT_PUBLIC_MOCK_ANALIZ === "true";

export type AnalizBbox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

export type AnalizAsamasi =
  | "sahne_araniyor"
  | "goruntu_indiriliyor"
  | "indeks_hesaplaniyor"
  | "cnn_dogrulama"
  | "tamamlandi";

export type AnalizDurumu = "calisiyor" | "bitti" | "hata";

export interface AnalizDurumSonucu {
  durum: AnalizDurumu;
  asama?: AnalizAsamasi;
  ilerleme?: number; // 0-100
  sonuc?: AnalizOzeti;
  hata?: string;
}

export interface AnalizIsi {
  isNo: string;
}

interface MockIs {
  durum: AnalizDurumu;
  asama: AnalizAsamasi;
  ilerleme: number;
  sonuc?: AnalizOzeti;
  hata?: string;
}

const mockIsler = new Map<string, MockIs>();

const MOCK_ASAMALARI: Array<{ asama: AnalizAsamasi; sureMs: number; ilerleme: number }> = [
  { asama: "sahne_araniyor", sureMs: 900, ilerleme: 15 },
  { asama: "goruntu_indiriliyor", sureMs: 1400, ilerleme: 45 },
  { asama: "indeks_hesaplaniyor", sureMs: 700, ilerleme: 70 },
  { asama: "cnn_dogrulama", sureMs: 900, ilerleme: 92 },
];

async function mockIsiYurut(
  isNo: string,
  bbox: AnalizBbox,
  tarihOnce: string,
  tarihSonra: string
) {
  const is = mockIsler.get(isNo);
  if (!is) return;

  try {
    for (const adim of MOCK_ASAMALARI) {
      await new Promise((r) => setTimeout(r, adim.sureMs));
      is.asama = adim.asama;
      is.ilerleme = adim.ilerleme;
    }

    const parametreler = new URLSearchParams({
      bbox: bbox.join(","),
      tarih_once: tarihOnce,
      tarih_sonra: tarihSonra,
    });
    const yanit = await fetch(`${API_TABAN_URL}/analiz?${parametreler}`, {
      cache: "no-store",
    });
    if (!yanit.ok) {
      const govde = await yanit.json().catch(() => null);
      throw new Error(govde?.detail ?? `/analiz isteği başarısız: ${yanit.status}`);
    }

    is.sonuc = await yanit.json();
    is.asama = "tamamlandi";
    is.ilerleme = 100;
    is.durum = "bitti";
  } catch (e) {
    is.durum = "hata";
    is.hata = e instanceof Error ? e.message : String(e);
  }
}

export async function analizBaslat(
  bbox: AnalizBbox,
  tarihOnce: string,
  tarihSonra: string
): Promise<AnalizIsi> {
  if (MOCK_ANALIZ) {
    const isNo = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mockIsler.set(isNo, { durum: "calisiyor", asama: "sahne_araniyor", ilerleme: 0 });
    void mockIsiYurut(isNo, bbox, tarihOnce, tarihSonra);
    return { isNo };
  }

  const yanit = await fetch(`${API_TABAN_URL}/analiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bbox, tarih_once: tarihOnce, tarih_sonra: tarihSonra }),
  });
  if (!yanit.ok) {
    const govde = await yanit.json().catch(() => null);
    throw new Error(govde?.detail ?? `/analiz başlatma isteği başarısız: ${yanit.status}`);
  }
  return yanit.json();
}

export async function analizDurumSorgula(isNo: string): Promise<AnalizDurumSonucu> {
  if (MOCK_ANALIZ) {
    const is = mockIsler.get(isNo);
    if (!is) {
      throw new Error(`Bilinmeyen iş no: ${isNo}`);
    }
    return {
      durum: is.durum,
      asama: is.asama,
      ilerleme: is.ilerleme,
      sonuc: is.sonuc,
      hata: is.hata,
    };
  }

  const yanit = await fetch(`${API_TABAN_URL}/analiz/${isNo}/durum`, { cache: "no-store" });
  if (!yanit.ok) {
    throw new Error(`/analiz/${isNo}/durum isteği başarısız: ${yanit.status}`);
  }
  return yanit.json();
}

/**
 * `durum !== "calisiyor"` olana kadar `analizDurumSorgula`'yı belli aralıklarla
 * çağırıp her sonucu `onIlerleme`'ye verir. Dönen fonksiyon polling'i erken
 * durdurmak için kullanılır (ör. component unmount olduğunda).
 */
export function analizIlerlemesiniIzle(
  isNo: string,
  onIlerleme: (durum: AnalizDurumSonucu) => void,
  aralikMs = 800
): () => void {
  let durduruldu = false;

  async function dongu() {
    while (!durduruldu) {
      const durum = await analizDurumSorgula(isNo);
      if (durduruldu) return;
      onIlerleme(durum);
      if (durum.durum !== "calisiyor") return;
      await new Promise((r) => setTimeout(r, aralikMs));
    }
  }

  dongu().catch((e) =>
    onIlerleme({ durum: "hata", hata: e instanceof Error ? e.message : String(e) })
  );

  return () => {
    durduruldu = true;
  };
}

// Perde (swipe) karşılaştırması için before/after Sentinel-2 gerçek renk PNG'leri
// (yalnızca dinamik/tamamlanmış işlerde mevcut — bkz. pipeline.rgb_export).
export function onceGoruntuUrl(isNo: string): string {
  return `${API_TABAN_URL}/analiz/${isNo}/once.png`;
}

export function sonraGoruntuUrl(isNo: string): string {
  return `${API_TABAN_URL}/analiz/${isNo}/sonra.png`;
}

// Rapor sayfasındaki "GeoJSON indir" butonu için — dinamik bir işin tespit
// poligonlarını indirir (statik demo modunda bunun yerine sabit /geojson kullanılır).
export function dinamikGeojsonUrl(isNo: string): string {
  return `${API_TABAN_URL}/analiz/${isNo}/geojson`;
}

export interface RaporSonucu {
  rapor: string;
  kullanim: { girdi_token: number; cikti_token: number };
}

export async function raporGetir(isNo?: string): Promise<RaporSonucu> {
  const url = isNo
    ? `${API_TABAN_URL}/rapor?is_no=${encodeURIComponent(isNo)}`
    : `${API_TABAN_URL}/rapor`;
  const yanit = await fetch(url, { cache: "no-store" });
  if (!yanit.ok) {
    const govde = await yanit.json().catch(() => null);
    throw new Error(govde?.detail ?? `/rapor isteği başarısız: ${yanit.status}`);
  }
  return yanit.json();
}
