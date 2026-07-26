import { useState } from "react"
import { KakaoMapCanvas } from "./maps/KakaoMapCanvas"
import { LeafletMapCanvas } from "./maps/LeafletMapCanvas"
import type { Coordinates, Place } from "../types"

type Props = {
  center: Coordinates
  radiusKm: number
  places: Place[]
  selectedId: string | null
  onSelect: (place: Place) => void
}

export function MapCanvas(props: Props) {
  // kakao: 메인 맵 파티션, leaflet: 서브 맵 파티션
  const [mapEngineMode, setMapEngineMode] = useState<"kakao" | "leaflet">("kakao")

  return (
    <div className="map-partition-wrapper" style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 맵 파티션 선택 컨트롤러 */}
      <div
        className="map-partition-switcher"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 1000,
          display: "flex",
          gap: "4px",
          background: "rgba(15, 23, 42, 0.85)",
          padding: "4px",
          borderRadius: "8px",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        <button
          type="button"
          onClick={() => setMapEngineMode("kakao")}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: mapEngineMode === "kakao" ? "#2563eb" : "transparent",
            color: mapEngineMode === "kakao" ? "#ffffff" : "#94a3b8",
          }}
        >
          📍 카카오 메인 맵
        </button>
        <button
          type="button"
          onClick={() => setMapEngineMode("leaflet")}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: mapEngineMode === "leaflet" ? "#059669" : "transparent",
            color: mapEngineMode === "leaflet" ? "#ffffff" : "#94a3b8",
          }}
        >
          🗺️ 오픈 서브 맵
        </button>
      </div>

      {/* 파티션 격리 마운트 */}
      {mapEngineMode === "kakao" ? (
        <KakaoMapCanvas {...props} />
      ) : (
        <LeafletMapCanvas {...props} />
      )}
    </div>
  )
}
