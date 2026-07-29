"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Rectangle, Tooltip } from "react-leaflet";
import { AOI_MERKEZ, AOI_SINIRLARI } from "@/lib/proje";

export default function HaritaOnizlemeMap() {
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
      <Rectangle
        bounds={AOI_SINIRLARI}
        pathOptions={{
          color: "#ff383c",
          weight: 2,
          dashArray: "6 4",
          fillOpacity: 0.05,
        }}
      >
        <Tooltip permanent direction="top" className="aoi-etiket">
          AOI · Arnavutköy
        </Tooltip>
      </Rectangle>
    </MapContainer>
  );
}
