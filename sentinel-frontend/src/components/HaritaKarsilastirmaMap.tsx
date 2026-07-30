"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { AOI_MERKEZ } from "@/lib/proje";
import type { DegisimOzellikleri } from "@/lib/api";

/**
 * Leaflet pane div'lerinin kendisi CSS kutu modelinde 0×0 boyuta sahiptir
 * (position:absolute, genişlik/yükseklik belirtilmez — içerik shrink-to-fit
 * olmaz çünkü çocuklar da absolute konumlanır). `clip-path: inset(%)` yüzdeleri
 * REFERANS KUTUYA göre hesaplanır; pane'in kendisine uygulanırsa %50, 0
 * genişliğin %50'si (=0) olur ve içerik TAMAMEN görünmez olur. Bunun yerine,
 * Leaflet'in gerçek pikse boyutunu verdiği ÇOCUK elemana (img veya svg)
 * uygulanır.
 */
function paneIcerigineKlipUygula(pane: HTMLElement | null, klip: string) {
  const icerik = pane?.querySelector<HTMLElement>("img, svg");
  if (icerik) icerik.style.clipPath = klip;
}

export interface SentinelGoruntuleri {
  onceUrl: string;
  sonraUrl: string;
  sinirlar: [[number, number], [number, number]];
}

/**
 * Harita `center`/`zoom` prop'ları yalnızca İLK render'da kullanılır (react-leaflet
 * sonradan değişikliklerini izlemez) — statik demo dışında sabit AOI_MERKEZ/zoom=12
 * kullanmak, kullanıcının çizdiği FARKLI bir bbox'ta haritayı eski (Arnavutköy)
 * konumda bırakır; gerçek görüntü doğru coğrafi konumda ama ekranın küçük, alakasız
 * bir köşesinde küçük bir yama olarak kalır. Bu bileşen dinamik sınırlar mevcut
 * olduğunda haritayı gerçekten o alana `fitBounds` ile yeniden çerçeveler.
 */
function HaritaGorunumunuAyarla({ sinirlar }: { sinirlar: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(sinirlar);
  }, [map, sinirlar]);
  return null;
}

/**
 * Perdenin (swipe) asıl gövdesi: before (once) ve after (sonra) gerçek renk
 * PNG'leri BBOX sınırlarına ImageOverlay olarak oturur, klipYuzdesi'ne göre
 * birbirini TAMAMLAYICI şekilde kırpılır (biri solda, diğeri sağda görünür).
 * Sadece dinamik çalıştırmalarda mevcut (bkz. sentinel-backend rgb_export) —
 * statik demo modunda bu bileşen hiç render edilmez, harita eski davranışıyla
 * (yalnızca OSM temel harita + poligon katmanı) çalışmaya devam eder.
 */
function SentinelGoruntuPerdesi({
  onceUrl,
  sonraUrl,
  sinirlar,
  klipYuzdesi,
}: {
  onceUrl: string;
  sonraUrl: string;
  sinirlar: [[number, number], [number, number]];
  klipYuzdesi: number;
}) {
  const map = useMap();

  if (!map.getPane("onceGoruntuPane")) {
    const pane = map.createPane("onceGoruntuPane");
    pane.style.zIndex = "300";
  }
  if (!map.getPane("sonraGoruntuPane")) {
    const pane = map.createPane("sonraGoruntuPane");
    pane.style.zIndex = "310";
  }

  useEffect(() => {
    // once (2018) ayracın solunda görünür: sağ taraf kırpılır.
    paneIcerigineKlipUygula(map.getPane("onceGoruntuPane") ?? null, `inset(0 ${100 - klipYuzdesi}% 0 0)`);
    // sonra (2025) ayracın sağında görünür: sol taraf kırpılır (degisimPane ile aynı mantık).
    paneIcerigineKlipUygula(map.getPane("sonraGoruntuPane") ?? null, `inset(0 0 0 ${klipYuzdesi}%)`);
  }, [map, klipYuzdesi, onceUrl, sonraUrl]);

  return (
    <>
      <ImageOverlay url={onceUrl} bounds={sinirlar} pane="onceGoruntuPane" />
      <ImageOverlay url={sonraUrl} bounds={sinirlar} pane="sonraGoruntuPane" />
    </>
  );
}

function DegisimKatmani({
  ozellikler,
  gorunur,
  klipYuzdesi,
}: {
  ozellikler: Feature<Geometry, DegisimOzellikleri>[];
  gorunur: boolean;
  klipYuzdesi: number;
}) {
  const map = useMap();

  // Pane, alt bileşen (GeoJSON) mount olmadan ÖNCE var olmalı — React
  // efektleri child-önce çalıştığı için bunu useEffect'e bırakmak GeoJSON'ın
  // henüz oluşmamış bir pane'e eklenmeye çalışmasına yol açıyor.
  if (!map.getPane("degisimPane")) {
    const pane = map.createPane("degisimPane");
    pane.style.zIndex = "450";
  }

  useEffect(() => {
    const pane = map.getPane("degisimPane") ?? null;
    paneIcerigineKlipUygula(
      pane,
      gorunur ? `inset(0 0 0 ${klipYuzdesi}%)` : "inset(0 0 0 100%)"
    );
    // GeoJSON `key={ozellikler.length}` degistiginde SVG yeniden monte olur
    // (yeni bir <svg>), bu yuzden ozellikler.length de bagimlilik listesinde --
    // yoksa yeni SVG klip-path'siz kalir.
  }, [map, gorunur, klipYuzdesi, ozellikler.length]);

  const koleksiyon: FeatureCollection<Geometry, DegisimOzellikleri> = {
    type: "FeatureCollection",
    features: ozellikler,
  };

  return (
    <GeoJSON
      key={ozellikler.length}
      data={koleksiyon}
      pane="degisimPane"
      style={() => ({
        color: "#e4572e",
        weight: 1.5,
        fillColor: "#e4572e",
        fillOpacity: 0.35,
      })}
    />
  );
}

export default function HaritaKarsilastirmaMap({
  ozellikler,
  gorunur,
  klipYuzdesi,
  sentinelGoruntuleri,
}: {
  ozellikler: Feature<Geometry, DegisimOzellikleri>[];
  gorunur: boolean;
  klipYuzdesi: number;
  sentinelGoruntuleri?: SentinelGoruntuleri;
}) {
  return (
    <MapContainer
      center={AOI_MERKEZ}
      zoom={12}
      scrollWheelZoom={false}
      className="absolute inset-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sentinelGoruntuleri && (
        <>
          <HaritaGorunumunuAyarla sinirlar={sentinelGoruntuleri.sinirlar} />
          <SentinelGoruntuPerdesi
            onceUrl={sentinelGoruntuleri.onceUrl}
            sonraUrl={sentinelGoruntuleri.sonraUrl}
            sinirlar={sentinelGoruntuleri.sinirlar}
            klipYuzdesi={klipYuzdesi}
          />
        </>
      )}
      <DegisimKatmani
        ozellikler={ozellikler}
        gorunur={gorunur}
        klipYuzdesi={klipYuzdesi}
      />
    </MapContainer>
  );
}
