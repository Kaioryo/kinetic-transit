'use client'

import { useEffect, useRef } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Shuttle } from '@/lib/types'

interface BusMarkerProps {
  shuttle: Shuttle
}

function createBusIcon(routeCode: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [60, 52],
    iconAnchor: [30, 52],
    popupAnchor: [0, -52],
    html: `
      <div class="bus-marker">
        <div class="bus-marker-label" style="background-color: ${color}; color: var(--on-primary, #c9ffdf);">
          ${routeCode}
        </div>
        <div class="bus-marker-icon" style="background-color: ${color}; color: var(--on-primary, #c9ffdf);">
          <span style="font-size: 16px;">🚌</span>
        </div>
      </div>
    `,
  })
}

function getRouteColor(routeId: string): string {
  const colors: Record<string, string> = {
    'JTN-01': '#006945',
    'JTN-02': '#4c5d6e',
  }
  return colors[routeId] || '#006945'
}

export default function BusMarker({ shuttle }: BusMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null)

  const color = getRouteColor(shuttle.route_id)
  const icon = createBusIcon(shuttle.route_code, color)

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
          <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
            Speed: {shuttle.speed_kmh} km/h
          </span>
          <br />
          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
            {shuttle.license_plate}
          </span>
        </div>
      </Popup>
    </Marker>
  )
}
