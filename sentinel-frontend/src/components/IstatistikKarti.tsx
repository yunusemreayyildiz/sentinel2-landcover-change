export default function IstatistikKarti({
  baslik,
  deger,
  altYazi,
  renk = "#14343b",
}: {
  baslik: string;
  deger: string;
  altYazi: string;
  renk?: string;
}) {
  return (
    <div className="bg-white border border-[#d8dfde] rounded-[9px] flex-1 flex flex-col gap-[6px] px-5 py-[18px]">
      <p className="font-semibold text-[#5e7376] text-[11px] tracking-[0.6px]">
        {baslik}
      </p>
      <p className="font-bold text-[30px]" style={{ color: renk }}>
        {deger}
      </p>
      <p className="font-medium text-[#5e7376] text-[11px]">{altYazi}</p>
    </div>
  );
}
