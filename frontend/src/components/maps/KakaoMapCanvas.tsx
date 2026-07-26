import { useEffect, useRef, useState } from "react"
import { fetchConfig } from "../../lib/api"
import type { Coordinates, Place } from "../../types"

type Props = {
  center: Coordinates
  radiusKm: number
  places: Place[]
  selectedId: string | null
  onSelect: (place: Place) => void
}

function loadKakaoSdkScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) {
      if (window.kakao.maps.load) {
        window.kakao.maps.load(() => resolve())
      } else {
        resolve()
      }
      return
    }

    const scriptId = "kakao-map-sdk-script"
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null

    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          clearInterval(checkInterval)
          if (window.kakao.maps.load) {
            window.kakao.maps.load(() => resolve())
          } else {
            resolve()
          }
        }
      }, 100)
      return
    }

    const script = document.createElement("script")
    script.id = scriptId
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer&autoload=false`
    script.onerror = () => reject(new Error("Kakao Maps SDK script network/domain load failed"))
    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => resolve())
      } else {
        reject(new Error("Kakao Maps SDK window.kakao.maps not found after script load"))
      }
    }
    document.head.appendChild(script)
  })
}

export function KakaoMapCanvas({ center, radiusKm, places, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")

  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const circleRef = useRef<any>(null)
  const overlayRef = useRef<any>(null)

  // 1. SDK 로드
  useEffect(() => {
    let isMounted = true

    async function initKakao() {
      try {
        let key = (import.meta.env.VITE_KAKAO_MAP_KEY || window.KAKAO_MAP_KEY || "").trim()

        if (!key) {
          const cfg = await fetchConfig()
          if (cfg.kakaoMapKey) {
            key = cfg.kakaoMapKey.trim()
          }
        }

        if (!key) {
          throw new Error("카카오 API 키가 설정되지 않았습니다 (.env의 KAKAO_MAP_APP_KEY/VITE_KAKAO_MAP_KEY 확인)")
        }

        await loadKakaoSdkScript(key)

        if (isMounted) {
          setLoadState("ready")
        }
      } catch (err: any) {
        if (isMounted) {
          setLoadState("error")
          setErrorMessage(err?.message || "카카오 지도 SDK를 로드하지 못했습니다.")
        }
      }
    }

    initKakao()

    return () => {
      isMounted = false
    }
  }, [])

  // 2. 카카오 지도 렌더링 제어
  useEffect(() => {
    if (loadState !== "ready" || !containerRef.current) return

    const maps = window.kakao.maps

    // 지도 최초 생성
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

    // 반경 원 (Circle) 갱신
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

    // 기존 마커 & 오버레이 정돈
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    if (overlayRef.current) {
      overlayRef.current.setMap(null)
    }

    // 다중 마커 생성
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

      // 선택 항목 오버레이 (툴팁)
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
  }, [loadState, center, radiusKm, places, selectedId, onSelect])

  if (loadState === "loading") {
    return (
      <div className="map-frame map-frame-status" aria-label="카카오 지도 연결 중">
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📍</div>
          <strong>카카오 지도 메인 엔진 연결 중...</strong>
        </div>
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div className="map-frame map-frame-status" aria-label="카카오 지도 오류">
        <div style={{ padding: "2rem", textAlign: "center", color: "#ef4444" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</div>
          <strong>카카오 지도 메인 파티션 활성화 필요</strong>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>{errorMessage}</p>
          <div style={{ marginTop: "1rem", fontSize: "0.8rem", background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", color: "#334155" }}>
            💡 카카오 Developers 앱 설정의 <strong>JavaScript 키</strong> 및 <strong>[플랫폼 &gt; Web 사이트 도메인]</strong>을 확인해 주세요.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="map-frame" aria-label={`${center.label} 주변 지도 (Kakao Maps 메인 파티션)`}>
      <div ref={containerRef} className="map-root" style={{ width: "100%", height: "100%" }} />
      <div className="map-credit" style={{ background: "rgba(37, 99, 235, 0.9)", color: "#fff" }}>
        📍 Kakao Maps 메인 파티션 활성화 중
      </div>
    </div>
  )
}
