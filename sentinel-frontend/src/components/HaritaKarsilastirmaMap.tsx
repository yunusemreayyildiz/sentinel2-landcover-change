"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { AOI_MERKEZ } from "@/lib/proje";
import type { DegisimOzellikleri } from "@/lib/api";

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
    const pane = map.getPane("degisimPane");
    if (!pane) return;
    pane.style.clipPath = gorunur
      ? `inset(0 0 0 ${klipYuzdesi}%)`
      : "inset(0 0 0 100%)";
  }, [map, gorunur, klipYuzdesi]);

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
}: {
  ozellikler: Feature<Geometry, DegisimOzellikleri>[];
  gorunur: boolean;
  klipYuzdesi: number;
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
      <DegisimKatmani
        ozellikler={ozellikler}
        gorunur={gorunur}
        klipYuzdesi={klipYuzdesi}
      />
    </MapContainer>
  );
}
