'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { TracePoint, PlaybackStop } from '@/components/history/PlaybackMap'
import styles from './page.module.css'

const PlaybackMap = dynamic(() => import('@/components/history/PlaybackMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Memuat peta…</div>,
})

interface HistoryTrip {
  id: number
  route_name: string
  bus_name: string
  started_at: string | null
  ended_at: string | null
  point_count: number
  duration_ms: number | null
}
interface TraceP extends TracePoint {
  t: number
  speed: number
}
interface TripDetail {
  trip: { id: number; route_name: string; bus_name: string; started_at: string | null; duration_ms: number }
  stops: PlaybackStop[]
  trace: TraceP[]
}

const SPEEDS = [5, 20, 60]

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Posisi bus pada waktu playback `ms` (interpolasi antar dua titik trace).
function interpolate(trace: TraceP[], ms: number) {
  if (trace.length === 0) return { pos: null as TracePoint | null, index: 0, speed: 0 }
  if (ms <= trace[0].t) return { pos: trace[0], index: 0, speed: trace[0].speed }
  const last = trace[trace.length - 1]
  if (ms >= last.t) return { pos: last, index: trace.length - 1, speed: last.speed }
  let i = 0
  while (i < trace.length - 1 && trace[i + 1].t < ms) i++
  const a = trace[i]
  const b = trace[i + 1]
  const span = b.t - a.t || 1
  const f = (ms - a.t) / span
  return {
    pos: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f },
    index: i,
    speed: a.speed,
  }
}

export default function HistoryPage() {
  const [trips, setTrips] = useState<HistoryTrip[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TripDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const [playing, setPlaying] = useState(false)
  const [playbackMs, setPlaybackMs] = useState(0)
  const [speed, setSpeed] = useState(20)

  const rafRef = useRef<number | undefined>(undefined)
  const lastRef = useRef<number | undefined>(undefined)

  const duration = detail?.trip.duration_ms ?? 0

  // Muat daftar trip.
  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((d) => setTrips(d.trips ?? []))
      .catch(() => setTrips([]))
  }, [])

  // Muat trace trip terpilih.
  const selectTrip = useCallback((id: number) => {
    setSelectedId(id)
    setPlaying(false)
    setPlaybackMs(0)
    setDetail(null)
    setLoading(true)
    fetch(`/api/history/${id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .finally(() => setLoading(false))
  }, [])

  // Loop animasi.
  useEffect(() => {
    if (!playing || duration <= 0) return
    lastRef.current = performance.now()
    const tick = (now: number) => {
      const dt = now - (lastRef.current ?? now)
      lastRef.current = now
      setPlaybackMs((prev) => {
        const next = prev + dt * speed
        if (next >= duration) {
          setPlaying(false)
          return duration
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speed, duration])

  const { pos, index, speed: curSpeed } = useMemo(
    () => interpolate(detail?.trace ?? [], playbackMs),
    [detail, playbackMs]
  )

  const togglePlay = useCallback(() => {
    if (!detail) return
    // Kalau sudah di ujung, mulai lagi dari awal.
    if (playbackMs >= duration) setPlaybackMs(0)
    setPlaying((p) => !p)
  }, [detail, playbackMs, duration])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Peta Live</Link>
        <h1 className={styles.title}>Riwayat Perjalanan</h1>
      </header>

      <div className={styles.body}>
        {/* Daftar trip */}
        <aside className={styles.sidebar}>
          <h2 className={styles.sideTitle}>Pilih Perjalanan</h2>
          {trips.length === 0 && <p className={styles.empty}>Belum ada perjalanan terekam.</p>}
          {trips.map((t) => (
            <button
              key={t.id}
              className={`${styles.tripItem} ${selectedId === t.id ? styles.tripActive : ''}`}
              onClick={() => selectTrip(t.id)}
            >
              <span className={styles.tripRoute}>{t.route_name}</span>
              <span className={styles.tripMeta}>
                {t.started_at ? new Date(t.started_at).toLocaleString('id-ID', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                }) : '—'}
              </span>
              <span className={styles.tripMeta}>
                {t.duration_ms ? `${Math.round(t.duration_ms / 60000)} mnt` : '—'} · {t.point_count} titik
              </span>
            </button>
          ))}
        </aside>

        {/* Peta + kontrol */}
        <main className={styles.main}>
          <div className={styles.mapWrap}>
            {loading ? (
              <div className={styles.mapLoading}>Memuat jejak…</div>
            ) : detail ? (
              <PlaybackMap
                trace={detail.trace}
                stops={detail.stops}
                position={pos}
                traveledCount={index + 1}
              />
            ) : (
              <div className={styles.mapLoading}>Pilih perjalanan di kiri untuk memutar rekamannya.</div>
            )}
          </div>

          {detail && (
            <div className={styles.controls}>
              <button className={styles.playBtn} onClick={togglePlay} aria-label={playing ? 'Jeda' : 'Putar'}>
                {playing ? '⏸' : '▶'}
              </button>

              <div className={styles.scrubWrap}>
                <input
                  className={styles.scrub}
                  type="range"
                  min={0}
                  max={duration}
                  value={playbackMs}
                  onChange={(e) => setPlaybackMs(Number(e.target.value))}
                />
                <div className={styles.times}>
                  <span>{fmt(playbackMs)}</span>
                  <span className={styles.curSpeed}>{Math.round(curSpeed)} km/j</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>

              <div className={styles.speeds}>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
                    onClick={() => setSpeed(s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
