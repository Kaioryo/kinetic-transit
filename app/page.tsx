'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTransitStore } from '@/lib/store'
import { useUserLocation } from '@/lib/useUserLocation'
import { haversineDistance } from '@/lib/geo-utils'
import LiveMap from '@/components/map/LiveMap'
import ArrivalList from '@/components/eta/ArrivalList'
import BusDetailList from '@/components/eta/BusDetailList'
import StopPicker from '@/components/eta/StopPicker'
import Header from '@/components/ui/Header'
import StatusChip from '@/components/ui/StatusChip'
import styles from './page.module.css'

export default function Home() {
  const tick = useTransitStore((state) => state.tick)
  const shuttles = useTransitStore((state) => state.shuttles)
  const stops = useTransitStore((state) => state.stops)
  const stopEtas = useTransitStore((state) => state.stopEtas)
  const selectedStopId = useTransitStore((state) => state.selectedStopId)
  const stopPickedManually = useTransitStore((state) => state.stopPickedManually)
  const selectStop = useTransitStore((state) => state.selectStop)
  const selectedShuttleId = useTransitStore((state) => state.selectedShuttleId)
  const clearShuttle = useTransitStore((state) => state.clearShuttle)

  const { location, status: geoStatus, request: requestLocation } = useUserLocation()
  const [pickerOpen, setPickerOpen] = useState(false)
  // Ditampilkan kalau user menekan tombol lokasi tapi izinnya sudah diblokir permanen.
  const [locationBlocked, setLocationBlocked] = useState(false)
  // Dinaikkan tiap tombol "Lokasi Saya" (header) ditekan → memicu peta menggeser
  // ke posisi user (perintah dijembatani ke RecenterController di dalam peta).
  const [recenterTick, setRecenterTick] = useState(0)

  const handleLocationClick = useCallback(async () => {
    // Sudah punya izin & posisi → cukup geser peta.
    if (geoStatus === 'granted' && location) {
      setRecenterTick((t) => t + 1)
      return
    }
    // Belum → minta izin. Kalau diblokir permanen, browser tak memunculkan dialog
    // lagi; beri tahu user lewat banner. Kalau berhasil, geser begitu posisi tiba.
    const result = await requestLocation()
    if (result === 'denied') setLocationBlocked(true)
    else if (result === 'granted') setRecenterTick((t) => t + 1)
  }, [geoStatus, location, requestLocation])

  // Tinggi panel ETA (mobile). null = otomatis mengikuti tinggi konten.
  // Di-set lewat CSS custom property agar tidak menabrak layout sidebar desktop.
  const [panelHeight, setPanelHeight] = useState<number | null>(null)
  const etaSectionRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const section = etaSectionRef.current
    if (!section) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startY: e.clientY,
      startHeight: section.getBoundingClientRect().height,
    }
  }, [])

  const handleDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    // Tarik ke ATAS = panel membesar, jadi selisihnya dibalik.
    const next = drag.startHeight - (e.clientY - drag.startY)
    const max = window.innerHeight * 0.75
    setPanelHeight(Math.min(Math.max(next, 84), max))
  }, [])

  const handleDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  // Klik ganda pada handle → kembalikan ke tinggi otomatis (mengikuti konten).
  const resetPanelHeight = useCallback(() => setPanelHeight(null), [])

  // Polling data live dari /api/live setiap 3 detik.
  useEffect(() => {
    tick()
    const interval = setInterval(tick, 3000)
    return () => clearInterval(interval)
  }, [tick])

  // Pilih halte TERDEKAT secara otomatis dari posisi user.
  // Tidak menimpa kalau user sudah memilih haltenya sendiri.
  useEffect(() => {
    if (!location || stops.length === 0 || stopPickedManually) return

    let nearest = stops[0]
    let minDist = Infinity
    for (const s of stops) {
      const d = haversineDistance(location.lat, location.lng, s.latitude, s.longitude)
      if (d < minDist) {
        minDist = d
        nearest = s
      }
    }
    selectStop(nearest.id, false)
  }, [location, stops, stopPickedManually, selectStop])

  const selectedStop = useMemo(
    () => stops.find((s) => s.id === selectedStopId) ?? null,
    [stops, selectedStopId]
  )

  const selectedStopEta = useMemo(
    () => stopEtas.find((s) => s.stop_id === selectedStopId) ?? null,
    [stopEtas, selectedStopId]
  )

  // Bus yang dipilih (klik marker). Kalau busnya sudah tidak aktif lagi (trip
  // berakhir), objeknya null → panel otomatis balik ke mode halte.
  const selectedShuttle = useMemo(
    () => shuttles.find((s) => s.id === selectedShuttleId) ?? null,
    [shuttles, selectedShuttleId]
  )
  const busMode = selectedShuttle !== null

  const servedStopIds = useMemo(() => new Set(stopEtas.map((s) => s.stop_id)), [stopEtas])

  // Label kecil di atas nama halte — menjelaskan ASAL pilihan haltenya.
  const stopLabel = stopPickedManually
    ? 'Halte Dipilih'
    : geoStatus === 'granted'
      ? 'Halte Terdekat'
      : geoStatus === 'denied'
        ? 'Lokasi Ditolak — Pilih Manual'
        : geoStatus === 'loading'
          ? 'Mencari Lokasi…'
          : 'Pilih Halte'

  return (
    <div className={styles.container}>
      <Header geoStatus={geoStatus} onLocationClick={handleLocationClick} />

      <main className={styles.main}>
        {/* Map Section — Top 50% */}
        <section className={styles.mapSection}>
          <LiveMap shuttles={shuttles} userLocation={location} recenterTick={recenterTick} />
          <div className={styles.mapScrim} />
          {locationBlocked && (
            <div className={styles.locationBlocked} role="alert">
              <span>
                Izin lokasi diblokir. Aktifkan lewat ikon gembok/izin di address bar browser, lalu
                muat ulang halaman.
              </span>
              <button
                className={styles.locationBlockedClose}
                onClick={() => setLocationBlocked(false)}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
          )}
        </section>

        {/* ETA Panel — hanya menampilkan SATU halte (terdekat / dipilih).
            Tingginya mengikuti konten; user bisa menariknya lewat handle. */}
        <section
          ref={etaSectionRef}
          className={styles.etaSection}
          style={
            { '--panel-h': panelHeight != null ? `${panelHeight}px` : 'auto' } as React.CSSProperties
          }
        >
          <div
            className={styles.dragHandle}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onDoubleClick={resetPanelHeight}
            role="separator"
            aria-label="Ubah tinggi panel halte (klik ganda untuk otomatis)"
            title="Tarik untuk ubah tinggi • klik ganda untuk otomatis"
          >
            <div className={styles.dragHandleBar} />
          </div>

          <div className={styles.etaHeader}>
            <div className={styles.etaHeaderText}>
              <span className={styles.etaLabel}>
                {busMode ? `Bus • ${selectedShuttle!.route_name}` : stopLabel}
              </span>
              <h2 className={styles.etaTitle}>
                {busMode
                  ? selectedShuttle!.bus_name
                  : selectedStop
                    ? selectedStop.name
                    : 'Belum ada halte'}
              </h2>
            </div>

            <div className={styles.etaHeaderActions}>
              <StatusChip />
              {busMode ? (
                <button className={styles.changeStopBtn} onClick={clearShuttle}>
                  ← Halte
                </button>
              ) : (
                <button
                  className={styles.changeStopBtn}
                  onClick={() => setPickerOpen(true)}
                  disabled={stops.length === 0}
                >
                  Ganti
                </button>
              )}
            </div>
          </div>

          <div className={styles.etaContent}>
            {busMode ? (
              <BusDetailList shuttle={selectedShuttle!} stopEtas={stopEtas} />
            ) : (
              <ArrivalList stopEta={selectedStopEta} hasSelectedStop={selectedStop !== null} />
            )}
          </div>
        </section>
      </main>

      {pickerOpen && (
        <StopPicker
          stops={stops}
          selectedStopId={selectedStopId}
          userLocation={location}
          servedStopIds={servedStopIds}
          onSelect={(id) => selectStop(id, true)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
