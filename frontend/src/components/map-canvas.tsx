import { KakaoMapCanvas } from "./maps/KakaoMapCanvas"
import type { Coordinates, Place } from "../types"

type Props = {
  center: Coordinates
  radiusKm: number
  places: Place[]
  selectedId: string | null
  onSelect: (place: Place) => void
}

export function MapCanvas(props: Props) {
  // 서브 맵 및 파티션 스위처 완벽 제거 -> 100% 단일 카카오 맵 고정
  return (
    <div className="map-partition-wrapper" style={{ position: "relative", width: "100%", height: "100%" }}>
      <KakaoMapCanvas {...props} />
    </div>
  )
}
