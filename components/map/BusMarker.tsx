'use client'

import { useEffect, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Shuttle } from '@/lib/types'

interface BusMarkerProps {
  shuttle: Shuttle
  /** Klik marker → pilih bus ini (panel bawah menampilkan halte + ETA-nya). */
  onSelect?: (shuttleId: string) => void
}

function createBusIcon(routeCode: string, color: string, isStale: boolean): L.DivIcon {
  // Bus basi (tidak mengirim GPS) ditampilkan redup & abu — posisinya adalah
  // lokasi TERAKHIR yang diketahui, bukan posisi sekarang.
  const fill = isStale ? '#8a9a94' : color
  const opacity = isStale ? 0.5 : 1

  return L.divIcon({
    className: '',
    iconSize: [60, 52],
    iconAnchor: [30, 52],
    popupAnchor: [0, -52],
    html: `
      <div class="bus-marker" style="opacity: ${opacity};">
        <div class="bus-marker-label" style="background-color: ${fill}; color: var(--on-primary, #c9ffdf);">
          ${routeCode}
        </div>
        <div class="bus-marker-icon" style="background-color: ${fill}; color: var(--on-primary, #c9ffdf);">
          <span style="font-size: 16px;">🚌</span>
        </div>
      </div>
    `,
  })
}

function formatSince(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins} menit`
  return `${Math.floor(mins / 60)} jam`
}

function getRouteColor(routeId: number): string {
  const colors: Record<number, string> = {
    1: '#006945', // Jalur A (Main Line)
    2: '#4c5d6e', // Jalur B
    3: '#b5651d', // Jalur C
  }
  return colors[routeId] || '#006945'
}

export default function BusMarker({ shuttle, onSelect }: BusMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null)

  const color = getRouteColor(shuttle.route_id)
  const icon = createBusIcon(shuttle.route_code, color, shuttle.is_stale)

  // Smooth movement animation
  useEffect(() => {
    if (markerRef.current) {
      const currentPos = markerRef.current.getLatLng()
      const targetPos = L.latLng(shuttle.latitude, shuttle.longitude)

      // Only animate if position actually changed
      if (
        Math.abs(currentPos.lat - targetPos.lat) > 0.000001 ||
        Math.abs(currentPos.lng - targetPos.lng) > 0.000001
      ) {
        // Smooth transition
        const steps = 20
        const dLat = (targetPos.lat - currentPos.lat) / steps
        const dLng = (targetPos.lng - currentPos.lng) / steps
        let step = 0

        const animate = () => {
          step++
          if (step <= steps && markerRef.current) {
            markerRef.current.setLatLng(
              L.latLng(
                currentPos.lat + dLat * step,
                currentPos.lng + dLng * step
              )
            )
            requestAnimationFrame(animate)
          }
        }

        requestAnimationFrame(animate)
      }
    }
  }, [shuttle.latitude, shuttle.longitude])

  return (
    <Marker
      ref={markerRef}
      position={[shuttle.latitude, shuttle.longitude]}
      icon={icon}
      eventHandlers={onSelect ? { click: () => onSelect(shuttle.id) } : undefined}
    >
      <Popup>
        <div style={{ fontFamily: 'var(--font-body)', minWidth: '160px' }}>
          <strong style={{ fontFamily: 'var(--font-headline)', fontSize: '1.1rem' }}>
            {shuttle.route_code} — {shuttle.route_name}
          </strong>
          <br />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--on-surface)' }}>
            {shuttle.bus_name}
          </span>
          <br />
          {shuttle.is_stale ? (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--error)' }}>
              ⚠ Sinyal terputus — posisi terakhir
              {shuttle.seconds_since_update != null &&
                ` (${formatSince(shuttle.seconds_since_update)} lalu)`}
            </span>
          ) : shuttle.is_stopped ? (
            // Beda dari sinyal terputus: GPS bus ini justru sehat dan posisinya
            // akurat — yang berhenti busnya.
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--error)' }}>
              ⏸ Bus berhenti
              {shuttle.stopped_seconds != null && ` — sudah ${formatSince(shuttle.stopped_seconds)}`}
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
              Speed: {shuttle.speed_kmh} km/h
            </span>
          )}
          <br />
          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
            {shuttle.license_plate}
          </span>
        </div>
      </Popup>
    </Marker>
  )
}
