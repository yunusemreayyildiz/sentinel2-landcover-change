"use client";

import dynamic from "next/dynamic";

const HaritaOnizlemeMap = dynamic(() => import("./HaritaOnizlemeMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-[#8fa6a3] text-sm">
      Harita yükleniyor...
    </div>
  ),
});

export default function HaritaOnizleme() {
  return (
    <div className="relative flex-1 h-full bg-[#212d31] overflow-hidden">
      <HaritaOnizlemeMap />
      <p className="absolute top-4 right-6 z-[500] text-[11px] font-medium text-[#8fa6a3] bg-[#212d31]/80 px-2 py-1 rounded pointer-events-none">
        41.18°N 28.74°E · Sentinel-2 L2A
      </p>
    </div>
  );
}
