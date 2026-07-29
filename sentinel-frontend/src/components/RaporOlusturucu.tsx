"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { raporGetir, type RaporSonucu } from "@/lib/api";

const TAHMINI_SURE_SN = 40;

export default function RaporOlusturucu() {
  const [durum, setDurum] = useState<"beklemede" | "yukleniyor" | "hazir" | "hata">(
    "beklemede"
  );
  const [sonuc, setSonuc] = useState<RaporSonucu | null>(null);
  const [hataMesaji, setHataMesaji] = useState("");
  const [gecenSaniye, setGecenSaniye] = useState(0);
  const zamanlayiciRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (zamanlayiciRef.current) clearInterval(zamanlayiciRef.current);
    };
  }, []);

  const raporOlustur = async () => {
    setDurum("yukleniyor");
    setGecenSaniye(0);
    zamanlayiciRef.current = setInterval(() => {
      setGecenSaniye((s) => s + 1);
    }, 1000);
    try {
      const veri = await raporGetir();
      setSonuc(veri);
      setDurum("hazir");
    } catch (e) {
      setHataMesaji(e instanceof Error ? e.message : String(e));
      setDurum("hata");
    } finally {
      if (zamanlayiciRef.current) {
        clearInterval(zamanlayiciRef.current);
        zamanlayiciRef.current = null;
      }
    }
  };

  return (
    <div className="bg-white border border-[#d8dfde] rounded-[9px] flex flex-col gap-3 px-5 py-[18px] w-full">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[#14343b] text-[14px]">
          Kurumsal Rapor (Claude Opus 4.8)
        </p>
        <button
          onClick={raporOlustur}
          disabled={durum === "yukleniyor"}
          className="bg-[rgba(139,107,83,0.88)] border border-[#ac2e2e] rounded-[7px] px-4 py-2 text-white text-[13px] font-bold disabled:opacity-60"
        >
          {durum === "yukleniyor"
            ? `Oluşturuluyor... (${gecenSaniye}sn)`
            : durum === "hazir"
              ? "Yeniden oluştur"
              : "Rapor Oluştur"}
        </button>
      </div>

      {durum === "beklemede" && (
        <p className="text-[#5e7376] text-[13px]">
          Analiz özetinden LLM ile kurumsal dilde bir rapor üretir. Her tıklama
          bir API çağrısıdır (ücretli).
        </p>
      )}

      {durum === "yukleniyor" && (
        <p className="text-[#5e7376] text-[13px]">
          Claude Opus 4.8 raporu yazıyor, bu genellikle yaklaşık{" "}
          {TAHMINI_SURE_SN} saniye sürer
          {gecenSaniye > TAHMINI_SURE_SN ? " — biraz uzun sürüyor, lütfen bekleyin" : ""}
          ...
        </p>
      )}

      {durum === "hata" && (
        <p className="text-[#ac2e2e] text-[13px]">Hata: {hataMesaji}</p>
      )}

      {durum === "hazir" && sonuc && (
        <>
          <div className="rapor-metni text-[#14343b] text-[13px] leading-relaxed max-h-[420px] overflow-y-auto border-t border-[#d8dfde] pt-3">
            <ReactMarkdown>{sonuc.rapor}</ReactMarkdown>
          </div>
          <p className="text-[#5e7376] text-[11px] border-t border-[#d8dfde] pt-2">
            Token kullanımı: {sonuc.kullanim.girdi_token} girdi +{" "}
            {sonuc.kullanim.cikti_token} çıktı
          </p>
        </>
      )}
    </div>
  );
}
