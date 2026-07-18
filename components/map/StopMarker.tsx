'use client'

import { useMemo } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { StopInfo } from '@/lib/store'

interface StopMarkerProps {
  stop: StopInfo
  isSelected: boolean
  onSelect: (stopId: number) => void
}

function createStopIcon(isSelected: boolean): L.DivIcon {
  const size = isSelected ? 34 : 24
  const inner = isSelected ? 12 : 8
  const ring = isSelected ? 4 : 3

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${isSelected ? '#045595' : '#ffffff'};
        border: ${ring}px solid #045595;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(4,85,149,${isSelected ? 0.4 : 0.15});
        cursor: pointer;
      ">
        <div style="
          width: ${inner}px;
          height: ${inner}px;
          background-color: ${isSelected ? '#ffffff' : '#045595'};
          border-radius: 50%;
        "></div>
      </div>
    `,
  })
}

export default function StopMarker({ stop, isSelected, onSelect }: StopMarkerProps) {
  const icon = useMemo(() => createStopIcon(isSelected), [isSelected])

  return (
    <Marker
      position={[stop.latitude, stop.longitude]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(stop.id) }}
      title={stop.name}
    />
  )
}
