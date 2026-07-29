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
}

export async function analizOzetiGetir(): Promise<AnalizOzeti> {
  const yanit = await fetch(`${API_TABAN_URL}/analiz`, { cache: "no-store" });
  if (!yanit.ok) {
    throw new Error(`/analiz isteği başarısız: ${yanit.status}`);
  }
  return yanit.json();
}

export interface RaporSonucu {
  rapor: string;
  kullanim: { girdi_token: number; cikti_token: number };
}

export async function raporGetir(): Promise<RaporSonucu> {
  const yanit = await fetch(`${API_TABAN_URL}/rapor`, { cache: "no-store" });
  if (!yanit.ok) {
    const govde = await yanit.json().catch(() => null);
    throw new Error(govde?.detail ?? `/rapor isteği başarısız: ${yanit.status}`);
  }
  return yanit.json();
}
