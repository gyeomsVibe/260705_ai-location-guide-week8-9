import { useEffect, useRef, useState } from "react"
import { fetchConfig } from "../../lib/api"
import type { Coordinates, Place } from "../../types"

type Props = {
  center: Coordinates
  radiusKm: number
  places: Place[]
  selectedId: string | null
  onSelect: (place: Place) => void
  onFallback?: () => void
}

function initKakaoMapsSdk(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 1. 이미 kakao.maps가 완벽히 로드되어 준비된 경우
    if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === "function") {
      try {
        window.kakao.maps.load(() => resolve())
        return
      } catch (e) {
        // 계속 진행
      }
    }

    const waitForKakao = (attemptsLeft = 20) => {
      if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === "function") {
        try {
          window.kakao.maps.load(() => resolve())
          return
        } catch (e) {
          reject(e)
          return
        }
      }
      if (attemptsLeft <= 0) {
        reject(new Error("Kakao Maps SDK load timeout"))
        return
      }
      setTimeout(() => waitForKakao(attemptsLeft - 1), 100)
    }

    const scriptId = "kakao-map-sdk"
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    if (!script) {
      script = document.createElement("script")
      script.id = scriptId
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer&autoload=false`
      script.async = true
      document.head.appendChild(script)
    }

    script.onload = () => waitForKakao()
    script.onerror = () => reject(new Error("Kakao Maps SDK script load error"))
    waitForKakao()
  })
}

export function KakaoMapCanvas({ center, radiusKm, places, selectedId, onSelect, onFallback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading")

  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const circleRef = useRef<any>(null)
  const overlayRef = useRef<any>(null)

  useEffect(() => {
    let isMounted = true

    async function prepareSdk() {
      try {
        let key = (import.meta.env.VITE_KAKAO_MAP_KEY || window.KAKAO_MAP_KEY || "").trim()
        if (!key) {
          const cfg = await fetchConfig()
          if (cfg.kakaoMapKey) key = cfg.kakaoMapKey.trim()
        }
        if (!key) {
          key = "012385551d235007080d46ee9ad59cb0"
        }

        await initKakaoMapsSdk(key)
        if (isMounted) setLoadState("ready")
      } catch (err) {
        console.warn("[KakaoMapCanvas] Kakao SDK 로드 실패 -> Leaflet 서브 맵으로 자동 전환합니다:", err)
        if (isMounted) {
          setLoadState("failed")
          if (onFallback) onFallback()
        }
      }
    }

    prepareSdk()

    return () => {
      isMounted = false
    }
  }, [onFallback])

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
      console.warn("[KakaoMapCanvas] 카카오 지도 객체 생성 예외 발생 -> Fallback 전환:", e)
      setLoadState("failed")
      if (onFallback) onFallback()
    }
  }, [loadState, center, radiusKm, places, selectedId, onSelect, onFallback])

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
    return null
  }

  return (
    <div className="map-frame" aria-label={`${center.label} 주변 지도 (Kakao Maps 메인 파티션)`}>
      <div ref={containerRef} className="map-root" style={{ width: "100%", height: "100%" }} />
      <div className="map-credit" style={{ background: "rgba(37, 99, 235, 0.9)", color: "#fff" }}>
        📍 Kakao Maps 메인 지도 활성화 중
      </div>
    </div>
  )
}
