import Link from "next/link";
import AppBar from "@/components/AppBar";
import HaritaOnizleme from "@/components/HaritaOnizleme";

export default function AnalizGirisSayfasi() {
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
            <div className="bg-white border-[1.5px] border-[#d8dfde] rounded-[7px] px-[14px] py-[12px] flex items-center justify-between">
              <p className="font-semibold text-[#14343b] text-[14px]">
                Arnavutköy, İstanbul
              </p>
              <p className="text-[#5e7376] text-[13px]">▾</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#5e7376] text-[11px] tracking-[0.6px]">
              KARŞILAŞTIRMA DÖNEMİ
            </p>
            <div className="flex gap-[10px] items-center">
              <div className="flex-1 bg-white border-[1.5px] border-[#d8dfde] rounded-[7px] px-[14px] py-[12px] flex items-center justify-center">
                <p className="font-medium text-[#14343b] text-[13px]">Tem 2018</p>
              </div>
              <p className="font-bold text-[#e4572e] text-[15px]">→</p>
              <div className="flex-1 bg-white border-[1.5px] border-[#d8dfde] rounded-[7px] px-[14px] py-[12px] flex items-center justify-center">
                <p className="font-medium text-[#14343b] text-[13px]">Tem 2025</p>
              </div>
            </div>
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

          <Link
            href="/karsilastirma"
            className="bg-[rgba(139,107,83,0.88)] border border-[#ac2e2e] rounded-[7px] py-[14px] flex flex-col items-center justify-center gap-[3px] text-center"
          >
            <span className="font-bold text-[15px] text-white">Analizi başlat</span>
            <span className="font-normal text-[11px] text-backgrounds-secondary">
              Uygun bulutsuz görüntüler otomatik seçilir
            </span>
          </Link>
        </div>

        <HaritaOnizleme />
      </div>
    </div>
  );
}
