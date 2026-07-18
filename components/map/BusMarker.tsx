'use client'

import { useEffect, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Shuttle } from '@/lib/types'
import { busIconMarkup, WarningIcon, PauseIcon } from '@/components/icons/Icons'

interface BusMarkerProps {
  shuttle: Shuttle
  /** Klik marker → pilih bus ini (panel bawah menampilkan halte + ETA-nya). */
  onSelect?: (shuttleId: string) => void
}

function createBusIcon(routeCode: string, color: string, textColor: string, isStale: boolean): L.DivIcon {
  // Bus basi (tidak mengirim GPS) ditampilkan redup & abu — posisinya adalah
  // lokasi TERAKHIR yang diketahui, bukan posisi sekarang.
  const fill = isStale ? '#8a94a0' : color
  const text = isStale ? '#ffffff' : textColor
  const opacity = isStale ? 0.5 : 1
  // Highlight radial tipis di atas warna solid — kesan bola/glossy, bukan flat
  // disc. Overlay putih transparan bekerja di atas warna fill apa pun.
  const glossyFill = `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.5), rgba(255,255,255,0) 60%), ${fill}`

  return L.divIcon({
    className: '',
    iconSize: [60, 52],
    iconAnchor: [30, 52],
    popupAnchor: [0, -52],
    html: `
      <div class="bus-marker" style="opacity: ${opacity};">
        <div class="bus-marker-label" style="background: ${glossyFill}; color: ${text};">
          ${routeCode}
        </div>
        <div class="bus-marker-icon" style="background: ${glossyFill}; color: ${text};">
          ${busIconMarkup(18)}
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

// Fill + teks per jalur. Jalur C memakai amber brand — perlu teks GELAP
// khusus di situ karena teks putih (dipakai jalur A/B) kontrasnya buruk
// di atas amber terang.
function getRouteColors(routeId: number): { fill: string; text: string } {
  const map: Record<number, { fill: string; text: string }> = {
    1: { fill: '#045595', text: '#ffffff' }, // Jalur A — biru brand (Main Line)
    2: { fill: '#4c6478', text: '#ffffff' }, // Jalur B — slate biru
    3: { fill: '#f4ae00', text: '#221900' }, // Jalur C — amber brand
  }
  return map[routeId] ?? map[1]
}

export default function BusMarker({ shuttle, onSelect }: BusMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null)

  const { fill, text } = getRouteColors(shuttle.route_id)
  const icon = createBusIcon(shuttle.route_code, fill, text, shuttle.is_stale)

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
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--error)',
              }}
            >
              <WarningIcon size={13} />
              Sinyal terputus — posisi terakhir
              {shuttle.seconds_since_update != null &&
                ` (${formatSince(shuttle.seconds_since_update)} lalu)`}
            </span>
          ) : shuttle.is_stopped ? (
            // Beda dari sinyal terputus: GPS bus ini justru sehat dan posisinya
            // akurat — yang berhenti busnya.
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--error)',
              }}
            >
              <PauseIcon size={13} />
              Bus berhenti
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
