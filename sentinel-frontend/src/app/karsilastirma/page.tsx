import AppBar from "@/components/AppBar";
import HaritaKarsilastirmaEkrani from "@/components/HaritaKarsilastirmaEkrani";

export default function HaritaKarsilastirmaSayfasi() {
  return (
    <div className="flex flex-col h-screen bg-[#f7f6f2]">
      <AppBar
        baslik="arnavutköy · 2018→2025 · yapılaşma"
        geri={{ href: "/", etiket: "← Yeni Analiz" }}
        ileri={{ href: "/rapor", etiket: "Rapor →" }}
      />
      <HaritaKarsilastirmaEkrani />
    </div>
  );
}
