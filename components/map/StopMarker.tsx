'use client'

import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

interface StopData {
  id: string
  name: string
  latitude: number
  longitude: number
}

interface StopMarkerProps {
  stop: StopData
}

const stopIcon = L.divIcon({
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background-color: #ffffff;
      border: 3px solid #006945;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,54,41,0.15);
    ">
      <div style="
        width: 8px;
        height: 8px;
        background-color: #006945;
        border-radius: 50%;
      "></div>
    </div>
  `,
})

export default function StopMarker({ stop }: StopMarkerProps) {
  return (
    <Marker
      position={[stop.latitude, stop.longitude]}
      icon={stopIcon}
    >
      <Popup>
        <div style={{ fontFamily: 'var(--font-body)', minWidth: '140px' }}>
          <strong style={{ fontFamily: 'var(--font-headline)', fontSize: '1rem' }}>
            {stop.name}
          </strong>
        </div>
      </Popup>
    </Marker>
  )
}
