import AppBar from "@/components/AppBar";
import IstatistikKarti from "@/components/IstatistikKarti";
import SinifGrafik from "@/components/SinifGrafik";
import DisaAktarimPaneli from "@/components/DisaAktarimPaneli";
import RaporOlusturucu from "@/components/RaporOlusturucu";
import { analizOzetiGetir, degisimGeojsonGetir } from "@/lib/api";
import { AOI_ALAN_HA } from "@/lib/proje";

export default async function AnalizRaporuSayfasi() {
  const [ozet, geojson] = await Promise.all([
    analizOzetiGetir(),
    degisimGeojsonGetir(),
  ]);

  const sinifToplamlari = new Map<string, number>();
  for (const f of geojson.features) {
    const { durum, sinif, alan_ha } = f.properties;
    if (durum !== "onaylandi" || sinif === "nan") continue;
    sinifToplamlari.set(sinif, (sinifToplamlari.get(sinif) ?? 0) + alan_ha);
  }
  const sinifVerileri = [...sinifToplamlari.entries()]
    .map(([sinif, alanHa]) => ({ sinif, alanHa }))
    .sort((a, b) => b.alanHa - a.alanHa);

  const degisimOrani = (ozet.sonuclar.onayli_alan_ha / AOI_ALAN_HA) * 100;

  return (
    <div className="flex flex-col h-screen bg-[#f7f6f2]">
      <AppBar
        baslik="rapor · arnavutköy 2018→2025"
        geri={{ href: "/karsilastirma", etiket: "← Karşılaştırma" }}
      />

      <div className="flex-1 overflow-y-auto px-8 py-7 flex flex-col gap-4">
        <div className="flex gap-4 w-full">
          <IstatistikKarti
            baslik="YENİ YAPILAŞMA"
            deger={`${ozet.sonuclar.onayli_alan_ha.toFixed(1)} ha`}
            altYazi="2018 → 2025"
            renk="#e4572e"
          />
          <IstatistikKarti
            baslik="TESPİT SAYISI"
            deger={String(ozet.sonuclar.onaylandi)}
            altYazi="CNN doğrulamalı, onaylı"
          />
          <IstatistikKarti
            baslik="DEĞİŞİM ORANI"
            deger={`%${degisimOrani.toFixed(1)}`}
            altYazi="AOI yüzölçümüne göre (yaklaşık)"
          />
        </div>

        <div className="flex gap-4 w-full items-stretch">
          <SinifGrafik veriler={sinifVerileri} />
          <DisaAktarimPaneli />
        </div>

        <RaporOlusturucu />
      </div>
    </div>
  );
}
