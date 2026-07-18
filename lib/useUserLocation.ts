'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================
// useUserLocation — posisi user via Geolocation API browser.
// Dipakai untuk memilih halte terdekat & menandai posisi user di peta.
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
  const watchIdRef = useRef<number | null>(null)

  const startWatch = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    // Kalau sudah ada watch berjalan, bersihkan dulu (mis. saat request ulang).
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    // watchPosition (bukan getCurrentPosition) supaya posisi & halte terdekat
    // ikut berubah kalau user berjalan.
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('granted')
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    )
  }, [])

  useEffect(() => {
    // Deteksi kapabilitas hanya bisa setelah mount (server tak punya `navigator`);
    // meletakkannya di initializer useState memicu hydration mismatch. startWatch
    // bisa memanggil setStatus('unavailable') secara sinkron di cabang itu — itu
    // memang disengaja dan hanya terjadi sekali saat mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startWatch()
    return () => {
      if (typeof navigator !== 'undefined' && navigator.geolocation && watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [startWatch])

  // Dipanggil saat user menekan tombol "Lokasi Saya".
  //
  // PENTING (batasan browser): kalau izin sudah DIBLOKIR permanen, memanggil
  // geolocation lagi TIDAK akan memunculkan dialog izin — browser langsung menolak.
  // Satu-satunya cara mengizinkan kembali adalah lewat setelan situs di browser
  // (ikon gembok di address bar). Fungsi ini mengembalikan Promise<GeoStatus>
  // supaya pemanggil bisa memberi tahu user hal itu.
  const request = useCallback(() => {
    return new Promise<GeoStatus>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable')
        resolve('unavailable')
        return
      }
      setStatus('loading')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setStatus('granted')
          startWatch() // lanjutkan pemantauan berkelanjutan
          resolve('granted')
        },
        (err) => {
          const next: GeoStatus = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'
          setStatus(next)
          resolve(next)
        },
        { enableHighAccuracy: true, timeout: 15_000 }
      )
    })
  }, [startWatch])

  return { location, status, request }
}
