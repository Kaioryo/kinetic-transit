'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { UserLocation } from '@/lib/useUserLocation'

interface RecenterControllerProps {
  location: UserLocation | null
  /** Naik tiap kali user menekan tombol "Lokasi Saya" di header. */
  recenterTick: number
}

// Komponen TAK TERLIHAT di dalam MapContainer. Tugasnya cuma satu: menggeser peta
// ke posisi user saat diminta. Tombolnya sendiri ada di header (di luar peta),
// yang tidak punya akses ke instance Leaflet — makanya perintahnya dijembatani
// lewat `recenterTick` yang berubah tiap klik.
export default function RecenterController({ location, recenterTick }: RecenterControllerProps) {
  const map = useMap()
  const lastTick = useRef(recenterTick)
  const pending = useRef(false)

  const flyTo = (loc: UserLocation) => map.flyTo([loc.lat, loc.lng], 18, { duration: 0.8 })

  // Saat tombol ditekan (tick berubah): kalau posisi sudah ada → langsung geser;
  // kalau belum (izin baru diminta, posisi menyusul) → tandai pending.
  useEffect(() => {
    if (recenterTick === lastTick.current) return
    lastTick.current = recenterTick
    if (location) flyTo(location)
    else pending.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterTick])

  // Posisi baru tiba setelah izin diberikan → tunaikan geser yang tertunda.
  useEffect(() => {
    if (pending.current && location) {
      pending.current = false
      flyTo(location)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  return null
}
