import AppBar from "@/components/AppBar";
import HaritaKarsilastirmaEkrani from "@/components/HaritaKarsilastirmaEkrani";

export default async function HaritaKarsilastirmaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ isNo?: string }>;
}) {
  const { isNo } = await searchParams;

  return (
    <div className="flex flex-col h-screen bg-[#f7f6f2]">
      <AppBar
        baslik="arnavutköy · 2018→2025 · yapılaşma"
        geri={{ href: "/", etiket: "← Yeni Analiz" }}
        ileri={{ href: isNo ? `/rapor?isNo=${isNo}` : "/rapor", etiket: "Rapor →" }}
      />
      <HaritaKarsilastirmaEkrani isNo={isNo} />
    </div>
  );
}
