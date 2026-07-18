'use client'

import { useMemo } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { UserLocation } from '@/lib/useUserLocation'

interface UserLocationMarkerProps {
  location: UserLocation
}

// Titik biru "posisi Anda" ala peta umum: inti biru + cincin berdenyut.
function createUserIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `
      <div style="position: relative; width: 22px; height: 22px;">
        <div style="
          position: absolute; inset: 0;
          border-radius: 50%;
          background: rgba(26, 115, 232, 0.25);
          animation: ktUserPulse 2s ease-out infinite;
        "></div>
        <div style="
          position: absolute; top: 50%; left: 50%;
          width: 14px; height: 14px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: #1a73e8;
          border: 2.5px solid #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        "></div>
      </div>
      <style>
        @keyframes ktUserPulse {
          0%   { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      </style>
    `,
  })
}

export default function UserLocationMarker({ location }: UserLocationMarkerProps) {
  const icon = useMemo(() => createUserIcon(), [])
  return (
    <Marker
      position={[location.lat, location.lng]}
      icon={icon}
      title="Posisi Anda"
      // Non-interaktif: hanya penanda, jangan menghalangi klik halte/bus di bawahnya.
      interactive={false}
      keyboard={false}
    />
  )
}
