// proje_durumu.md ile birebir: Arnavutkoy / IGA Havalimani cevresi
export const AOI_BBOX = {
  bati: 28.6,
  guney: 41.1,
  dogu: 28.9,
  kuzey: 41.35,
};

export const AOI_MERKEZ: [number, number] = [41.225, 28.75];

export const AOI_SINIRLARI: [[number, number], [number, number]] = [
  [AOI_BBOX.guney, AOI_BBOX.bati],
  [AOI_BBOX.kuzey, AOI_BBOX.dogu],
];

// Yaklasik AOI alani (bbox tabanli, poligonla kirpilmis degil).
// Enlem/boylam farkini ortalama enlemde km'ye cevirip dikdortgen alan hesaplar.
const ORTALAMA_ENLEM_RADYAN = (AOI_MERKEZ[0] * Math.PI) / 180;
const KM_PER_DERECE_BOYLAM = 111.32 * Math.cos(ORTALAMA_ENLEM_RADYAN);
const KM_PER_DERECE_ENLEM = 110.57;
const GENISLIK_KM = (AOI_BBOX.dogu - AOI_BBOX.bati) * KM_PER_DERECE_BOYLAM;
const YUKSEKLIK_KM = (AOI_BBOX.kuzey - AOI_BBOX.guney) * KM_PER_DERECE_ENLEM;
export const AOI_ALAN_HA = GENISLIK_KM * YUKSEKLIK_KM * 100; // km^2 -> ha
