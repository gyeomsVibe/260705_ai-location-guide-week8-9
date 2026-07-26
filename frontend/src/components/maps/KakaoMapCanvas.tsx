import { useEffect, useRef, useState } from "react"
import type { Coordinates, Place } from "../../types"

type Props = {
  center: Coordinates
  radiusKm: number
  places: Place[]
  selectedId: string | null
  onSelect: (place: Place) => void
}

export function KakaoMapCanvas({ center, radiusKm, places, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const circleRef = useRef<any>(null)
  const overlayRef = useRef<any>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading")

  // SDK 초기화 (autoload=false 지원: kakao.maps.load 콜백 필수 호출)
  useEffect(() => {
    let isMounted = true

    const initKakao = () => {
      if (window.kakao && window.kakao.maps) {
        if (typeof window.kakao.maps.load === "function") {
          window.kakao.maps.load(() => {
            if (isMounted) setLoadState("ready")
          })
          return true
        }
        if (window.kakao.maps.Map) {
          if (isMounted) setLoadState("ready")
          return true
        }
      }
      return false
    }

    if (initKakao()) return

    // 정적 스크립트 로드 완료 시점까지 폴링 체크 (최대 10초 대기)
    let attempts = 100
    const interval = setInterval(() => {
      if (initKakao()) {
        clearInterval(interval)
      } else {
        attempts--
        if (attempts <= 0) {
          clearInterval(interval)
          console.warn("[KakaoMapCanvas] 카카오 SDK 로드 실패")
          if (isMounted) setLoadState("failed")
        }
      }
    }, 100)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // 지도 렌더링
  useEffect(() => {
    if (loadState !== "ready" || !containerRef.current || !window.kakao || !window.kakao.maps) return

    const maps = window.kakao.maps

    try {
      if (!mapRef.current) {
        const options = {
          center: new maps.LatLng(center.lat, center.lng),
          level: 4,
        }
        mapRef.current = new maps.Map(containerRef.current, options)
      }

      const map = mapRef.current

      // 지도 중심 이동
      const selectedPlace = places.find((p) => p.id === selectedId)
      const targetLat = selectedPlace ? selectedPlace.lat : center.lat
      const targetLng = selectedPlace ? selectedPlace.lng : center.lng
      map.panTo(new maps.LatLng(targetLat, targetLng))

      // 반경 원 (Circle)
      if (circleRef.current) {
        circleRef.current.setMap(null)
      }
      circleRef.current = new maps.Circle({
        center: new maps.LatLng(center.lat, center.lng),
        radius: radiusKm * 1000,
        strokeWeight: 2,
        strokeColor: "#2563eb",
        strokeOpacity: 0.8,
        strokeStyle: "solid",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
      })
      circleRef.current.setMap(map)

      // 기존 마커 & 오버레이 제거
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      if (overlayRef.current) {
        overlayRef.current.setMap(null)
      }

      // 마커 추가
      places.forEach((place) => {
        const isSelected = place.id === selectedId
        const position = new maps.LatLng(place.lat, place.lng)

        const marker = new maps.Marker({
          position,
          map,
          title: place.name,
        })

        maps.event.addListener(marker, "click", () => {
          onSelect(place)
        })

        markersRef.current.push(marker)

        if (isSelected) {
          const content = document.createElement("div")
          content.className = "kakao-custom-overlay-card"
          content.style.cssText = `
            background: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(59, 130, 246, 0.4);
            backdrop-filter: blur(8px);
            white-space: nowrap;
          `
          content.innerHTML = `
            <strong style="display:block; font-size:14px; margin-bottom:2px; color:#60a5fa;">${place.name}</strong>
            <span style="color:#94a3b8;">${place.distanceKm.toFixed(1)}km · ${place.address}</span>
          `

          overlayRef.current = new maps.CustomOverlay({
            content,
            map,
            position,
            yAnchor: 1.35,
          })
        }
      })
    } catch (e) {
      console.warn("[KakaoMapCanvas] 카카오 지도 렌더링 예외 발생:", e)
      setLoadState("failed")
    }
  }, [loadState, center, radiusKm, places, selectedId, onSelect])

  if (loadState === "loading") {
    return (
      <div className="map-frame map-frame-status" aria-label="카카오 지도 연결 중">
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📍</div>
          <strong>카카오 지도 연결 중...</strong>
        </div>
      </div>
    )
  }

  if (loadState === "failed") {
    return (
      <div className="map-frame map-frame-status" aria-label="카카오 지도 로드 실패">
        <div style={{ padding: "3rem", textAlign: "center", color: "#ef4444" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</div>
          <strong>카카오 지도 로드 실패</strong>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginTop: "0.5rem" }}>
            네트워크 연결 또는 카카오 개발자 콘솔 설정을 확인해 주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-frame" aria-label={`${center.label} 주변 지도`}>
      <div ref={containerRef} className="map-root" style={{ width: "100%", height: "100%" }} />
      <div className="map-credit" style={{ background: "rgba(37, 99, 235, 0.9)", color: "#fff" }}>
        📍 Kakao Maps
      </div>
    </div>
  )
}
