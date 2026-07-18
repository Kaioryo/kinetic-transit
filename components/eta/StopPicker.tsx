'use client'

import { useMemo, useState } from 'react'
import { StopInfo } from '@/lib/store'
import { haversineDistance } from '@/lib/geo-utils'
import { CloseIcon } from '@/components/icons/Icons'
import styles from './StopPicker.module.css'

interface StopPickerProps {
  stops: StopInfo[]
  selectedStopId: number | null
  /** Posisi user, kalau ada — dipakai untuk mengurutkan halte terdekat dulu. */
  userLocation: { lat: number; lng: number } | null
  /** stop_id yang punya bus menuju ke sana (untuk penanda "ada bus"). */
  servedStopIds: Set<number>
  onSelect: (stopId: number) => void
  onClose: () => void
}

export default function StopPicker({
  stops,
  selectedStopId,
  userLocation,
  servedStopIds,
  onSelect,
  onClose,
}: StopPickerProps) {
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const filtered = stops.filter((s) =>
      s.name.toLowerCase().includes(query.trim().toLowerCase())
    )

    // Kalau lokasi user diketahui, urutkan dari yang terdekat.
    if (userLocation) {
      return filtered
        .map((s) => ({
          stop: s,
          distanceKm: haversineDistance(userLocation.lat, userLocation.lng, s.latitude, s.longitude),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
    }

    return filtered
      .map((s) => ({ stop: s, distanceKm: null as number | null }))
      .sort((a, b) => a.stop.name.localeCompare(b.stop.name))
  }, [stops, query, userLocation])

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label="Pilih halte">
        <div className={styles.header}>
          <h3 className={styles.title}>Pilih Halte</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">
            <CloseIcon size={16} />
          </button>
        </div>

        <input
          className={styles.search}
          placeholder="Cari halte…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className={styles.list}>
          {list.length === 0 && <p className={styles.noResult}>Halte tidak ditemukan.</p>}

          {list.map(({ stop, distanceKm }) => (
            <button
              key={stop.id}
              className={`${styles.item} ${stop.id === selectedStopId ? styles.itemSelected : ''}`}
              onClick={() => {
                onSelect(stop.id)
                onClose()
              }}
            >
              <span className={styles.itemName}>{stop.name}</span>
              <span className={styles.itemMeta}>
                {distanceKm != null && (
                  <span className={styles.itemDistance}>
                    {distanceKm < 1
                      ? `${Math.round(distanceKm * 1000)} m`
                      : `${distanceKm.toFixed(1)} km`}
                  </span>
                )}
                {servedStopIds.has(stop.id) ? (
                  <span className={styles.dotServed} title="Ada bus menuju halte ini" />
                ) : (
                  <span className={styles.dotIdle} title="Tidak ada bus" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
