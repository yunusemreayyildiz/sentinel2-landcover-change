import type { AnalizBbox } from "@/lib/api";

// proje_durumu.md ile birebir: Arnavutkoy / IGA Havalimani cevresi
export const AOI_BBOX = {
  bati: 28.6,
  guney: 41.1,
  dogu: 28.9,
  kuzey: 41.35,
};

// Backend "min_lon,min_lat,max_lon,max_lat" bbox sirasiyla ayni (main.py).
export const AOI_BBOX_TUPLE: AnalizBbox = [
  AOI_BBOX.bati,
  AOI_BBOX.guney,
  AOI_BBOX.dogu,
  AOI_BBOX.kuzey,
];

export const AOI_MERKEZ: [number, number] = [41.225, 28.75];

export const AOI_SINIRLARI: [[number, number], [number, number]] = [
  [AOI_BBOX.guney, AOI_BBOX.bati],
  [AOI_BBOX.kuzey, AOI_BBOX.dogu],
];

// sentinel-backend/CLAUDE.md madde 6 ile ayni ust sinir.
export const BBOX_ALAN_LIMITI_KM2 = 750;

// Yaklasik alan (bbox tabanli, poligonla kirpilmis degil). Enlem/boylam
// farkini ortalama enlemde km'ye cevirip dikdortgen alan hesaplar. Backend
// pyproj.Geod ile gercek jeodezik alani hesaplar (CLAUDE.md madde 6) --
// bu yalnizca arayuzde erken uyari icin yaklasik bir istemci tarafi kontroludur.
export function bboxAlaniKm2([minLon, minLat, maxLon, maxLat]: AnalizBbox): number {
  const ortalamaEnlemRadyan = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kmPerDereceBoylam = 111.32 * Math.cos(ortalamaEnlemRadyan);
  const kmPerDereceEnlem = 110.57;
  const genislikKm = (maxLon - minLon) * kmPerDereceBoylam;
  const yukseklikKm = (maxLat - minLat) * kmPerDereceEnlem;
  return genislikKm * yukseklikKm;
}

export const AOI_ALAN_HA = bboxAlaniKm2(AOI_BBOX_TUPLE) * 100; // km^2 -> ha
