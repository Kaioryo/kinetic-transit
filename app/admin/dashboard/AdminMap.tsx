'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

type Stop = { id: number; name: string; latitude: number | string; longitude: number | string }

type Props = {
  stops: Stop[]
  onMapClick: (lat: number, lng: number) => void
  pickedCoord: { lat: number; lng: number } | null
}

// Fix Leaflet icon default
function fixLeafletIcon() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

// Ikon halte existing (biru brand)
const stopIcon = L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;background:#045595;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

// Ikon titik yang dipilih (merah, lebih besar)
const pickedIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#ba1a1a;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(186,26,26,0.5)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function AdminMap({ stops, onMapClick, pickedCoord }: Props) {
  useEffect(() => { fixLeafletIcon() }, [])

  // Center peta di tengah kampus Unpad Jatinangor
  const center: [number, number] = [-6.9255, 107.7740]

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ width: '100%', height: '100%', borderRadius: '12px' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onMapClick={onMapClick} />

      {/* Render semua halte existing */}
      {stops.map(s => (
        <Marker
          key={s.id}
          position={[Number(s.latitude), Number(s.longitude)]}
          icon={stopIcon}
        >
          <Popup>{s.name}</Popup>
        </Marker>
      ))}

      {/* Render titik yang dipilih */}
      {pickedCoord && (
        <Marker position={[pickedCoord.lat, pickedCoord.lng]} icon={pickedIcon}>
          <Popup>Titik baru: {pickedCoord.lat.toFixed(6)}, {pickedCoord.lng.toFixed(6)}</Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
