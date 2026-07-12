'use client'

import { useEffect, useState } from 'react'

// ============================================
// useUserLocation — posisi user via Geolocation API browser.
// Dipakai untuk memilih halte terdekat secara otomatis.
//
// Catatan: di produksi Geolocation HANYA jalan lewat HTTPS
// (localhost dikecualikan, jadi aman saat development).
// ============================================

export type GeoStatus = 'loading' | 'granted' | 'denied' | 'unavailable'

export interface UserLocation {
  lat: number
  lng: number
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [status, setStatus] = useState<GeoStatus>('loading')

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Deteksi kapabilitas browser hanya bisa dilakukan setelah mount:
      // meletakkannya di initializer useState akan memicu hydration mismatch
      // (server tidak punya `navigator`, jadi status awalnya beda dari client).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('unavailable')
      return
    }

    // watchPosition (bukan getCurrentPosition) supaya halte terdekat ikut
    // berubah kalau user berjalan ke halte lain.
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('granted')
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return { location, status }
}
