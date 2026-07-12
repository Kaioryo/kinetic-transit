'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Shuttle } from '@/lib/types'
import { useTransitStore } from '@/lib/store'
import BusMarker from './BusMarker'
import StopMarker from './StopMarker'

// Center on Jatinangor campus
const JATINANGOR_CENTER: [number, number] = [-6.9295, 107.7757]
const DEFAULT_ZOOM = 17

// Fix default Leaflet icon issue in Next.js
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

interface MapContentProps {
  shuttles: Shuttle[]
}

function MapUpdater({ shuttles }: { shuttles: Shuttle[] }) {
  const map = useMap()
  const initialRef = useRef(true)

  useEffect(() => {
    if (initialRef.current && shuttles.length > 0) {
      // Auto-center ke posisi bus pertama kali ada data
      const firstBus = shuttles[0]
      if (firstBus.latitude !== 0 && firstBus.longitude !== 0) {
        map.setView([firstBus.latitude, firstBus.longitude], 17)
        initialRef.current = false
      }
    }
  }, [shuttles, map])

  return null
}

export default function MapContent({ shuttles }: MapContentProps) {
  // Ambil stops dari Zustand store (data dari MySQL, bukan mock)
  const stops = useTransitStore((state) => state.stops)
  const selectedStopId = useTransitStore((state) => state.selectedStopId)
  const selectStop = useTransitStore((state) => state.selectStop)

  return (
    <MapContainer
      center={JATINANGOR_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapUpdater shuttles={shuttles} />

      {/* Stop markers dari database — tap untuk memilih halte di panel ETA */}
      {stops.map((stop) => (
        <StopMarker
          key={stop.id}
          stop={stop}
          isSelected={stop.id === selectedStopId}
          onSelect={selectStop}
        />
      ))}

      {/* Shuttle markers */}
      {shuttles.map((shuttle) => (
        <BusMarker key={shuttle.id} shuttle={shuttle} />
      ))}
    </MapContainer>
  )
}
