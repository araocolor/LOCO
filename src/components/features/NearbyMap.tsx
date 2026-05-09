"use client";

import { useEffect, useRef, useState } from "react";


export default function NearbyMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
    if (!appKey) {
      setError("카카오맵 키가 없습니다.");
      setLoading(false);
      return;
    }

    function initMap(lat: number, lng: number) {
      if (!mapRef.current || !window.kakao) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kakao = window.kakao as any;
      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(lat, lng),
        level: 4,
      });
      new kakao.maps.Marker({
        map,
        position: new kakao.maps.LatLng(lat, lng),
      });
      setLoading(false);
    }

    function loadMap() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((window.kakao as any)?.maps) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window.kakao as any).maps.load(() => initMap(latitude, longitude));
          }
        },
        () => {
          setError("위치 권한을 허용해주세요.");
          setLoading(false);
        }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.kakao as any)?.maps) {
      loadMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = loadMap;
    script.onerror = () => {
      setError("카카오맵을 불러오지 못했습니다.");
      setLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 160px)" }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-8 h-8 border-4 border-[#FEE500] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
