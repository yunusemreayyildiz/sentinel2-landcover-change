"use client";

import { useEffect, useState } from "react";
import {
  analizIlerlemesiniIzle,
  type AnalizAsamasi,
  type AnalizDurumSonucu,
  type AnalizOzeti,
} from "@/lib/api";

const ASAMA_ETIKETLERI: Record<AnalizAsamasi, string> = {
  sahne_araniyor: "Sahne aranıyor",
  goruntu_indiriliyor: "Görüntü indiriliyor",
  indeks_hesaplaniyor: "İndeks hesaplanıyor",
  cnn_dogrulama: "CNN doğrulama",
  tamamlandi: "Tamamlandı",
};

const ASAMA_SIRASI: AnalizAsamasi[] = [
  "sahne_araniyor",
  "goruntu_indiriliyor",
  "indeks_hesaplaniyor",
  "cnn_dogrulama",
];

export default function AnalizIlerlemeEkrani({
  isNo,
  onTamamlandi,
}: {
  isNo: string;
  onTamamlandi: (sonuc: AnalizOzeti) => void;
}) {
  const [durum, setDurum] = useState<AnalizDurumSonucu>({
    durum: "calisiyor",
    asama: "sahne_araniyor",
    ilerleme: 0,
  });

  useEffect(() => {
    return analizIlerlemesiniIzle(isNo, (yeniDurum) => {
      setDurum(yeniDurum);
      if (yeniDurum.durum === "bitti" && yeniDurum.sonuc) {
        onTamamlandi(yeniDurum.sonuc);
      }
    });
  }, [isNo, onTamamlandi]);

  const aktifIndeks = durum.asama ? ASAMA_SIRASI.indexOf(durum.asama) : 0;

  return (
    <div className="absolute inset-0 z-[700] flex items-center justify-center bg-[#14343b]">
      <div className="flex flex-col gap-5 w-[360px]">
        <p className="text-white text-[15px] font-semibold text-center">
          {durum.durum === "hata" ? "Analiz başarısız" : "Analiz çalışıyor…"}
        </p>

        <div className="h-[6px] w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-[#e4572e] transition-all duration-500"
            style={{ width: `${durum.ilerleme ?? 0}%` }}
          />
        </div>

        <div className="flex flex-col gap-2">
          {ASAMA_SIRASI.map((asama, i) => (
            <p
              key={asama}
              className={`text-[13px] ${
                i < aktifIndeks
                  ? "text-[#8fbf9e]"
                  : i === aktifIndeks && durum.durum === "calisiyor"
                    ? "text-white font-semibold"
                    : "text-white/40"
              }`}
            >
              {i < aktifIndeks ? "✓ " : i === aktifIndeks ? "→ " : "· "}
              {ASAMA_ETIKETLERI[asama]}
            </p>
          ))}
        </div>

        {durum.durum === "hata" && (
          <p className="text-[#f2b8a2] text-[13px] text-center">{durum.hata}</p>
        )}
      </div>
    </div>
  );
}
