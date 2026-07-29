import { API_TABAN_URL } from "@/lib/api";

export default function DisaAktarimPaneli() {
  return (
    <div className="bg-white border border-[#d8dfde] rounded-[9px] flex flex-col gap-3 px-5 py-[18px] w-[380px] shrink-0">
      <p className="font-semibold text-[#14343b] text-[14px]">Dışa Aktarım</p>
      <p className="text-[#5e7376] text-[12px]">
        Tespit poligonları ve rapor, kurum içi sistemlerde kullanılmak üzere
        indirilebilir.
      </p>

      <a
        href={`${API_TABAN_URL}/geojson`}
        download="degisim_analizi.geojson"
        className="bg-[#40544a] border-[1.5px] border-[#14343b] rounded-[7px] py-[11px] flex items-center justify-center text-center"
      >
        <span className="font-bold text-[#14343b] text-[13px]">
          GeoJSON indir (tespit poligonları)
        </span>
      </a>

      <div className="bg-[#14343b] opacity-40 cursor-not-allowed border-[1.5px] border-[#14343b] rounded-[7px] py-[11px] flex items-center justify-center gap-2">
        <span className="font-bold text-white text-[13px]">PDF raporu indir</span>
        <span className="border border-white/40 rounded text-[10px] font-medium text-white px-[7px] py-[2px]">
          geliştirilebilir
        </span>
      </div>

      <div className="bg-[rgba(121,55,36,0.49)] opacity-40 cursor-not-allowed border-[1.5px] border-[#14343b] rounded-[7px] py-[11px] flex items-center justify-center gap-2">
        <span className="font-bold text-[#14343b] text-[13px]">
          Değişim maskesi (GeoTIFF)
        </span>
        <span className="border border-[#14343b]/40 rounded text-[10px] font-medium text-[#14343b] px-[7px] py-[2px]">
          geliştirilebilir
        </span>
      </div>
    </div>
  );
}
