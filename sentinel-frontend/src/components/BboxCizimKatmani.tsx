"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import type { AnalizBbox } from "@/lib/api";

L.drawLocal.draw.toolbar.buttons.rectangle = "Alan çiz (dikdörtgen)";
L.drawLocal.draw.toolbar.actions.title = "Çizimi iptal et";
L.drawLocal.draw.toolbar.actions.text = "İptal";
L.drawLocal.draw.toolbar.finish.title = "Çizimi bitir";
L.drawLocal.draw.toolbar.finish.text = "Bitir";
L.drawLocal.draw.toolbar.undo.title = "Son noktayı sil";
L.drawLocal.draw.toolbar.undo.text = "Son noktayı sil";
L.drawLocal.draw.handlers.rectangle.tooltip.start =
  "Alanı belirlemek için sürükleyin";
L.drawLocal.edit.toolbar.buttons.edit = "Alanı düzenle";
L.drawLocal.edit.toolbar.buttons.editDisabled = "Düzenlenecek alan yok";
L.drawLocal.edit.toolbar.actions.save.title = "Değişiklikleri kaydet";
L.drawLocal.edit.toolbar.actions.save.text = "Kaydet";
L.drawLocal.edit.toolbar.actions.cancel.title = "Düzenlemeyi iptal et";
L.drawLocal.edit.toolbar.actions.cancel.text = "İptal";
L.drawLocal.edit.handlers.edit.tooltip.text =
  "Şekli değiştirmek için köşe noktalarını sürükleyin";
L.drawLocal.edit.handlers.edit.tooltip.subtext = "İptal etmek için iptal'e basın";

function dikdortgendenBboxCikar(katman: L.Layer): AnalizBbox {
  const sinirlar = (katman as L.Rectangle).getBounds();
  return [
    sinirlar.getWest(),
    sinirlar.getSouth(),
    sinirlar.getEast(),
    sinirlar.getNorth(),
  ];
}

/**
 * Haritaya tek-dikdörtgen çizim/düzenleme kontrolü ekler (leaflet-draw).
 * Silme kapalı: yeni alan çizmek eskisinin yerini otomatik alır, böylece
 * "seçili bbox yok" boş durumuyla uğraşmaya gerek kalmaz.
 */
export default function BboxCizimKatmani({
  bbox,
  onBboxDegisti,
}: {
  bbox: AnalizBbox;
  onBboxDegisti: (bbox: AnalizBbox) => void;
}) {
  const map = useMap();
  const grupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    const grup = new L.FeatureGroup();
    grupRef.current = grup;
    map.addLayer(grup);

    const [minLon, minLat, maxLon, maxLat] = bbox;
    grup.addLayer(
      L.rectangle(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        { color: "#ff383c", weight: 2, dashArray: "6 4", fillOpacity: 0.05 }
      )
    );

    const cizimKontrolu = new L.Control.Draw({
      position: "topright",
      draw: {
        rectangle: { showArea: false },
        polygon: false,
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: {
        featureGroup: grup,
        remove: false,
      },
    });
    map.addControl(cizimKontrolu);

    function olusturulduAlgila(e: L.LeafletEvent) {
      const olay = e as L.DrawEvents.Created;
      if (olay.layerType !== "rectangle") return;
      grup.clearLayers();
      grup.addLayer(olay.layer);
      onBboxDegisti(dikdortgendenBboxCikar(olay.layer));
    }

    function duzenlendiAlgila(e: L.LeafletEvent) {
      const olay = e as L.DrawEvents.Edited;
      olay.layers.eachLayer((katman) => {
        onBboxDegisti(dikdortgendenBboxCikar(katman));
      });
    }

    map.on(L.Draw.Event.CREATED, olusturulduAlgila);
    map.on(L.Draw.Event.EDITED, duzenlendiAlgila);

    return () => {
      map.off(L.Draw.Event.CREATED, olusturulduAlgila);
      map.off(L.Draw.Event.EDITED, duzenlendiAlgila);
      map.removeControl(cizimKontrolu);
      map.removeLayer(grup);
    };
    // bbox prop'u yalnizca ilk cizimi olusturur; kullanicinin cizdigi/duzenledigi
    // dikdortgeni her bbox degisiminde yeniden kurup imlecin altindan cekmemek
    // icin bagimlilik listesine bilerek eklenmiyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
