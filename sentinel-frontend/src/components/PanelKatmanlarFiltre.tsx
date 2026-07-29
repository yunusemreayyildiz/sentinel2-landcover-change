import type { DegisimOzellikleri } from "@/lib/api";

function GelistirilebilirRozet() {
  return (
    <span className="border border-[#d8dfde] rounded text-[10px] font-medium text-[#5e7376] px-[7px] py-[2px] ml-auto">
      geliştirilebilir
    </span>
  );
}

export default function PanelKatmanlarFiltre({
  maskeGorunur,
  onMaskeGorunurDegisti,
  guvenEsigi,
  onGuvenEsigiDegisti,
  gosterilenTespitSayisi,
  enBuyukTespitler,
}: {
  maskeGorunur: boolean;
  onMaskeGorunurDegisti: (deger: boolean) => void;
  guvenEsigi: number;
  onGuvenEsigiDegisti: (deger: number) => void;
  gosterilenTespitSayisi: number;
  enBuyukTespitler: DegisimOzellikleri[];
}) {
  return (
    <div className="flex flex-col h-full w-[400px] shrink-0 bg-[rgba(255,235,224,0.05)] overflow-y-auto">
      <div className="border-b border-[#d8dfde] px-[18px] pt-4 pb-3">
        <p className="font-semibold text-[#14343b] text-[14px]">
          Katmanlar &amp; Filtre
        </p>
      </div>

      <div className="border-b border-[#d8dfde] px-[18px] py-3 flex flex-col gap-[10px]">
        <label className="flex items-center gap-[10px] cursor-pointer">
          <input
            type="checkbox"
            checked={maskeGorunur}
            onChange={(e) => onMaskeGorunurDegisti(e.target.checked)}
            className="size-4 accent-[#0e7c86]"
          />
          <span className="size-[12px] rounded-[3px] bg-[#e4572e]" />
          <p className="text-[#14343b] text-[13px]">Yapılaşma maskesi</p>
        </label>

        <div className="flex items-center gap-[10px] opacity-50">
          <input type="checkbox" checked readOnly disabled className="size-4" />
          <span className="size-[12px] rounded-[3px] bg-[#5c808a]" />
          <p className="text-[#14343b] text-[13px]">Sentinel-2 gerçek renk</p>
          <GelistirilebilirRozet />
        </div>

        <div className="flex items-center gap-[10px] opacity-50">
          <input type="checkbox" readOnly disabled className="size-4" />
          <span className="size-[12px] rounded-[3px] bg-[#8fbf9e]" />
          <p className="text-[#14343b] text-[13px]">NDBI fark katmanı</p>
          <GelistirilebilirRozet />
        </div>
      </div>

      <div className="border-b border-[#d8dfde] px-[18px] pt-3.5 pb-4 flex flex-col gap-[10px]">
        <p className="font-semibold text-[#5e7376] text-[11px] tracking-[0.6px]">
          GÜVEN EŞİĞİ
        </p>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={guvenEsigi}
          onChange={(e) => onGuvenEsigiDegisti(Number(e.target.value))}
          className="w-full accent-[#e4572e]"
        />
        <p className="font-medium text-[#e4572e] text-[12px]">
          ≥ {guvenEsigi.toFixed(2)} · {gosterilenTespitSayisi} tespit gösteriliyor
        </p>
      </div>

      <div className="px-[18px] pt-3.5 pb-2.5">
        <p className="font-semibold text-[#5e7376] text-[11px] tracking-[0.6px]">
          TESPİTLER
        </p>
      </div>

      {enBuyukTespitler.length === 0 && (
        <p className="px-[18px] py-3 text-[13px] text-[#5e7376]">
          Bu eşikte onaylı tespit yok.
        </p>
      )}

      {enBuyukTespitler.map((t, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-[18px] py-[11px] ${
            i === 0 ? "bg-[#fdefe9]" : ""
          }`}
        >
          <div className="flex gap-[10px] items-center">
            <p className="font-semibold text-[#e4572e] text-[11px]">
              #{String(i + 1).padStart(2, "0")}
            </p>
            <p className="text-[#14343b] text-[13px]">
              {t.sinif} · {t.alan_ha.toFixed(1)} ha
            </p>
          </div>
          <p className="text-[#5e7376] text-[11px]">{t.guven.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}
