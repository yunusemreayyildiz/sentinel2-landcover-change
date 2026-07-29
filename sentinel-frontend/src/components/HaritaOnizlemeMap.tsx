"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { MapContainer, TileLayer } from "react-leaflet";
import { AOI_MERKEZ } from "@/lib/proje";
import type { AnalizBbox } from "@/lib/api";
import BboxCizimKatmani from "@/components/BboxCizimKatmani";

export default function HaritaOnizlemeMap({
  bbox,
  onBboxDegisti,
}: {
  bbox: AnalizBbox;
  onBboxDegisti: (bbox: AnalizBbox) => void;
}) {
  return (
    <MapContainer
      center={AOI_MERKEZ}
      zoom={11}
      scrollWheelZoom={false}
      className="absolute inset-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BboxCizimKatmani bbox={bbox} onBboxDegisti={onBboxDegisti} />
    </MapContainer>
  );
}
