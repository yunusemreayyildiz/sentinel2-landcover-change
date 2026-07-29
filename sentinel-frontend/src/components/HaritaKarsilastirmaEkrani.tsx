"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Feature, Geometry } from "geojson";
import {
  degisimGeojsonGetir,
  type AnalizOzeti,
  type DegisimOzellikleri,
} from "@/lib/api";
import PanelKatmanlarFiltre from "@/components/PanelKatmanlarFiltre";
import AnalizIlerlemeEkrani from "@/components/AnalizIlerlemeEkrani";

const HaritaKarsilastirmaMap = dynamic(
  () => import("@/components/HaritaKarsilastirmaMap"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center text-[#8fa6a3] text-sm">
        Harita yükleniyor...
      </div>
    ),
  }
);

export default function HaritaKarsilastirmaEkrani({ isNo }: { isNo?: string }) {
  const [tumOzellikler, setTumOzellikler] = useState<
    Feature<Geometry, DegisimOzellikleri>[] | null
  >(null);
  const [hata, setHata] = useState<string | null>(null);
  const [dinamikSonuc, setDinamikSonuc] = useState<AnalizOzeti | null>(null);
  const [analizBitti, setAnalizBitti] = useState(!isNo);

  const [guvenEsigi, setGuvenEsigi] = useState(0.6);
  const [maskeGorunur, setMaskeGorunur] = useState(true);
  const [klipYuzdesi, setKlipYuzdesi] = useState(50);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const haritaAlaniRef = useRef<HTMLDivElement>(null);

  // Dinamik çalıştırma kendi GeoJSON'unu getirdiyse onu kullan; getirmediyse
  // (statik demo akışı) ayrı /geojson isteğiyle doldurulan tumOzellikler'e düş.
  const dinamikOzellikler = useMemo(
    () =>
      dinamikSonuc?.geojson
        ? (dinamikSonuc.geojson.features as Feature<Geometry, DegisimOzellikleri>[])
        : null,
    [dinamikSonuc]
  );
  const ozellikler = dinamikOzellikler ?? tumOzellikler;

  useEffect(() => {
    if (!analizBitti || dinamikOzellikler) return;
    degisimGeojsonGetir()
      .then((veri) =>
        setTumOzellikler(veri.features as Feature<Geometry, DegisimOzellikleri>[])
      )
      .catch((e) => setHata(String(e)));
  }, [analizBitti, dinamikOzellikler]);

  const onayliOzellikler = useMemo(() => {
    if (!ozellikler) return [];
    return ozellikler
      .filter(
        (f) => f.properties.durum === "onaylandi" && f.properties.guven >= guvenEsigi
      )
      .sort((a, b) => b.properties.alan_ha - a.properties.alan_ha);
  }, [ozellikler, guvenEsigi]);

  const enBuyukTespitler = useMemo(
    () => onayliOzellikler.slice(0, 6).map((f) => f.properties),
    [onayliOzellikler]
  );

  const yuzdeHesapla = useCallback((clientX: number) => {
    const alan = haritaAlaniRef.current;
    if (!alan) return 50;
    const dikdortgen = alan.getBoundingClientRect();
    const oran = ((clientX - dikdortgen.left) / dikdortgen.width) * 100;
    return Math.min(96, Math.max(4, oran));
  }, []);

  useEffect(() => {
    if (!surukleniyor) return;
    const hareket = (e: PointerEvent) => setKlipYuzdesi(yuzdeHesapla(e.clientX));
    const birak = () => setSurukleniyor(false);
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
    return () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
    };
  }, [surukleniyor, yuzdeHesapla]);

  return (
    <div className="flex flex-1 min-h-0">
      <PanelKatmanlarFiltre
        maskeGorunur={maskeGorunur}
        onMaskeGorunurDegisti={setMaskeGorunur}
        guvenEsigi={guvenEsigi}
        onGuvenEsigiDegisti={setGuvenEsigi}
        gosterilenTespitSayisi={onayliOzellikler.length}
        enBuyukTespitler={enBuyukTespitler}
      />

      <div ref={haritaAlaniRef} className="relative flex-1 h-full bg-[#31473c] overflow-hidden">
        {isNo && !analizBitti && (
          <AnalizIlerlemeEkrani
            isNo={isNo}
            onTamamlandi={(sonuc) => {
              setDinamikSonuc(sonuc);
              setAnalizBitti(true);
            }}
          />
        )}

        {hata && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-[#31473c] text-[#f2b8a2] text-sm text-center px-8">
            /geojson yüklenemedi. Backend çalışıyor mu? ({hata})
          </div>
        )}

        {dinamikSonuc && (
          <div className="absolute top-0 inset-x-0 z-[550] bg-[#0e7c86] text-white text-[11px] px-4 py-[6px] flex items-center justify-between gap-4">
            <span>
              Dinamik analiz sonucu — aday: {dinamikSonuc.sonuclar.aday_poligon} ·
              onaylandı: {dinamikSonuc.sonuclar.onaylandi} · elendi:{" "}
              {dinamikSonuc.sonuclar.elendi} · onaylı alan:{" "}
              {dinamikSonuc.sonuclar.onayli_alan_ha} ha
            </span>
            {!dinamikSonuc.geojson && (
              <span className="opacity-70 shrink-0">
                Poligon katmanı demo verisidir — backend bu çalıştırma için
                GeoJSON döndürmedi
              </span>
            )}
          </div>
        )}

        {ozellikler && (
          <HaritaKarsilastirmaMap
            ozellikler={onayliOzellikler}
            gorunur={maskeGorunur}
            klipYuzdesi={klipYuzdesi}
          />
        )}

        <p className="absolute top-4 left-4 z-[500] bg-[rgba(20,52,59,0.88)] text-white text-[12px] font-medium px-[10px] py-[5px] rounded-[5px] pointer-events-none">
          Temmuz 2018 (temel harita)
        </p>
        <p className="absolute top-4 right-4 z-[500] bg-[rgba(20,52,59,0.88)] text-white text-[12px] font-medium px-[10px] py-[5px] rounded-[5px] pointer-events-none">
          Temmuz 2025 (+ yapılaşma tespiti)
        </p>

        <div
          className="absolute top-0 bottom-0 z-[500] w-[3px] bg-white cursor-ew-resize"
          style={{ left: `${klipYuzdesi}%` }}
          onPointerDown={() => setSurukleniyor(true)}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[38px] rounded-full bg-white shadow flex items-center justify-center font-bold text-[#14343b] text-[15px]">
            ⇔
          </div>
        </div>
      </div>
    </div>
  );
}
