"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "@/components/AppBar";
import HaritaOnizleme from "@/components/HaritaOnizleme";
import { analizBaslat, type AnalizBbox } from "@/lib/api";
import { AOI_BBOX_TUPLE, BBOX_ALAN_LIMITI_KM2, bboxAlaniKm2 } from "@/lib/proje";

const VARSAYILAN_ONCE = "2018-07-04";
const VARSAYILAN_SONRA = "2025-07-09";

// Backend mevsim kısıtı (sentinel-backend/CLAUDE.md madde 4): her iki tarih
// de Haziran–Eylül penceresinde olmalı, yoksa dNDVI sahte yapılaşma üretir.
function ayGecerliMi(tarih: string): boolean {
  const ay = Number(tarih.slice(5, 7));
  return ay >= 6 && ay <= 9;
}

export default function AnalizGirisSayfasi() {
  const router = useRouter();
  const [bbox, setBbox] = useState<AnalizBbox>(AOI_BBOX_TUPLE);
  const [tarihOnce, setTarihOnce] = useState(VARSAYILAN_ONCE);
  const [tarihSonra, setTarihSonra] = useState(VARSAYILAN_SONRA);
  const [baslatiliyor, setBaslatiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const onceGecerli = ayGecerliMi(tarihOnce);
  const sonraGecerli = ayGecerliMi(tarihSonra);
  const tarihlerGecerli = onceGecerli && sonraGecerli;
  const bboxAlanKm2 = bboxAlaniKm2(bbox);
  const bboxGecerli = bboxAlanKm2 <= BBOX_ALAN_LIMITI_KM2;

  async function analiziBaslat() {
    setHata(null);
    setBaslatiliyor(true);
    try {
      const { isNo } = await analizBaslat(bbox, tarihOnce, tarihSonra);
      router.push(`/karsilastirma?isNo=${isNo}`);
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
      setBaslatiliyor(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#f7f6f2]">
      <AppBar baslik="yeni analiz" />

      <div className="flex flex-1 min-h-0 bg-[#f8f4f1]">
        <div className="flex flex-col gap-[22px] w-[400px] shrink-0 p-8 overflow-y-auto">
          <h1 className="font-semibold text-[#14343b] text-[20px]">Yeni Analiz</h1>

          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#5e7376] text-[11px] tracking-[0.6px]">
              BÖLGE
            </p>
            <div
              className={`bg-white border-[1.5px] rounded-[7px] px-[14px] py-[12px] flex items-center justify-between ${
                bboxGecerli ? "border-[#d8dfde]" : "border-[#e4572e]"
              }`}
            >
              <p className="font-semibold text-[#14343b] text-[14px]">
                Seçili alan: {bboxAlanKm2.toFixed(0)} km²
              </p>
              <p className="text-[#5e7376] text-[11px]">
                harita üzerinden çizin
              </p>
            </div>
            {!bboxGecerli && (
              <p className="text-[#e4572e] text-[11px]">
                Seçili alan {bboxAlanKm2.toFixed(0)} km² — izin verilen üst
                sınır {BBOX_ALAN_LIMITI_KM2} km². Alanı küçültün.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#5e7376] text-[11px] tracking-[0.6px]">
              KARŞILAŞTIRMA DÖNEMİ
            </p>
            <div className="flex gap-[10px] items-center">
              <input
                type="date"
                value={tarihOnce}
                onChange={(e) => setTarihOnce(e.target.value)}
                className={`flex-1 bg-white border-[1.5px] rounded-[7px] px-[10px] py-[10px] text-[13px] font-medium text-[#14343b] ${
                  onceGecerli ? "border-[#d8dfde]" : "border-[#e4572e]"
                }`}
              />
              <p className="font-bold text-[#e4572e] text-[15px]">→</p>
              <input
                type="date"
                value={tarihSonra}
                onChange={(e) => setTarihSonra(e.target.value)}
                className={`flex-1 bg-white border-[1.5px] rounded-[7px] px-[10px] py-[10px] text-[13px] font-medium text-[#14343b] ${
                  sonraGecerli ? "border-[#d8dfde]" : "border-[#e4572e]"
                }`}
              />
            </div>
            {!tarihlerGecerli && (
              <p className="text-[#e4572e] text-[11px]">
                Her iki tarih de Haziran–Eylül aralığında olmalı (mevsim kısıtı).
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#5e7376] text-[11px] tracking-[0.6px]">
              KARAR TİPİ
            </p>

            <div className="bg-[#eaf4f3] border-[1.5px] border-[#0e7c86] rounded-[7px] px-[14px] py-[12px] flex items-center gap-[10px]">
              <span className="size-[10px] rounded-full bg-[#0e7c86]" />
              <p className="font-semibold text-[#14343b] text-[14px]">
                Yapılaşma tespiti
              </p>
            </div>

            <div className="bg-white border-[1.5px] border-[#d8dfde] rounded-[7px] px-[14px] py-[12px] flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <span className="size-[10px] rounded-full border border-[#d8dfde]" />
                <p className="text-[#5e7376] text-[14px]">
                  Orman / yeşil alan değişimi
                </p>
              </div>
              <span className="border border-[#d8dfde] rounded text-[10px] font-medium text-[#5e7376] px-[7px] py-[2px]">
                geliştirilebilir
              </span>
            </div>

            <div className="bg-white border-[1.5px] border-[#d8dfde] rounded-[7px] px-[14px] py-[12px] flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <span className="size-[10px] rounded-full border border-[#d8dfde]" />
                <p className="text-[#5e7376] text-[14px]">Su kütlesi değişimi</p>
              </div>
              <span className="border border-[#d8dfde] rounded text-[10px] font-medium text-[#5e7376] px-[7px] py-[2px]">
                geliştirilebilir
              </span>
            </div>
          </div>

          <button
            onClick={analiziBaslat}
            disabled={!tarihlerGecerli || !bboxGecerli || baslatiliyor}
            className="bg-[rgba(139,107,83,0.88)] border border-[#ac2e2e] rounded-[7px] py-[14px] flex flex-col items-center justify-center gap-[3px] text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="font-bold text-[15px] text-white">
              {baslatiliyor ? "Analiz başlatılıyor…" : "Analizi başlat"}
            </span>
            <span className="font-normal text-[11px] text-backgrounds-secondary">
              Uygun bulutsuz görüntüler otomatik seçilir
            </span>
          </button>

          {hata && (
            <p className="text-[#ac2e2e] text-[12px]">
              Analiz başlatılamadı: {hata}
            </p>
          )}
        </div>

        <HaritaOnizleme bbox={bbox} onBboxDegisti={setBbox} />
      </div>
    </div>
  );
}
