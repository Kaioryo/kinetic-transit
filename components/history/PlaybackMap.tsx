'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'

export interface TracePoint {
  lat: number
  lng: number
}
export interface PlaybackStop {
  name: string
  lat: number
  lng: number
}

interface PlaybackMapProps {
  trace: TracePoint[]
  stops: PlaybackStop[]
  /** Posisi bus sekarang (hasil interpolasi di halaman). */
  position: TracePoint | null
  /** Berapa banyak titik trace yang sudah dilewati (untuk mewarnai jalur yang sudah ditempuh). */
  traveledCount: number
}

const JATINANGOR: [number, number] = [-6.9295, 107.7757]

function busIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:#006945;border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;font-size:15px;">🚌</div>`,
  })
}

// Sekali: paskan tampilan peta ke seluruh jejak.
function FitBounds({ trace }: { trace: TracePoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (trace.length < 2) return
    const bounds = L.latLngBounds(trace.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [trace, map])
  return null
}

export default function PlaybackMap({ trace, stops, position, traveledCount }: PlaybackMapProps) {
  const icon = useMemo(() => busIcon(), [])
  const full = useMemo(() => trace.map((p) => [p.lat, p.lng] as [number, number]), [trace])
  const traveled = useMemo(
    () => full.slice(0, Math.max(1, Math.min(traveledCount, full.length))),
    [full, traveledCount]
  )

  return (
    <MapContainer
      center={JATINANGOR}
      zoom={16}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds trace={trace} />

      {/* Seluruh jejak (samar) */}
      {full.length > 1 && (
        <Polyline positions={full} pathOptions={{ color: '#4c5d6e', weight: 3, opacity: 0.35 }} />
      )}
      {/* Bagian yang sudah ditempuh (tegas) */}
      {traveled.length > 1 && (
        <Polyline positions={traveled} pathOptions={{ color: '#006945', weight: 5, opacity: 0.9 }} />
      )}

      {/* Halte sebagai konteks */}
      {stops.map((s) => (
        <CircleMarker
          key={s.name}
          center={[s.lat, s.lng]}
          radius={5}
          pathOptions={{ color: '#006945', weight: 2, fillColor: '#fff', fillOpacity: 1 }}
        />
      ))}

      {/* Bus bergerak */}
      {position && <Marker position={[position.lat, position.lng]} icon={icon} interactive={false} />}
    </MapContainer>
  )
}
