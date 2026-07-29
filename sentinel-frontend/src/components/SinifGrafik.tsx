export default function SinifGrafik({
  veriler,
}: {
  veriler: { sinif: string; alanHa: number }[];
}) {
  const enBuyuk = Math.max(...veriler.map((v) => v.alanHa), 1);

  return (
    <div className="bg-white border border-[#d8dfde] rounded-[9px] flex-1 flex flex-col gap-3 px-5 py-[18px]">
      <p className="font-semibold text-[#14343b] text-[14px]">
        Sınıf Bazında Onaylı Alan
      </p>
      {veriler.map((v) => (
        <div key={v.sinif} className="flex gap-3 items-center w-full">
          <p className="text-[#5e7376] text-[13px] w-[110px] shrink-0">
            {v.sinif}
          </p>
          <div
            className="bg-[rgba(228,87,46,0.9)] h-[15px] rounded-[3px]"
            style={{ width: `${Math.max(4, (v.alanHa / enBuyuk) * 100)}%` }}
          />
          <p className="font-semibold text-[#14343b] text-[11px] whitespace-nowrap">
            {v.alanHa.toFixed(1)} ha
          </p>
        </div>
      ))}
    </div>
  );
}
