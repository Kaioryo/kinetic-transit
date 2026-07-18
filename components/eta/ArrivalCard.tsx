'use client'

import { Arrival } from '@/lib/types'
import styles from './ArrivalCard.module.css'

interface ArrivalCardProps {
  arrival: Arrival
  index: number
}

/** "4 menit" / "1 jam 12 menit" — untuk sub-teks "berhenti sejak". */
function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} menit`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours} jam ${rest} menit` : `${hours} jam`
}

// Aksen kiri kartu — menyampaikan urgensi status sekilas pandang, tanpa harus
// membaca angkanya dulu (amber = akan tiba, merah = terlambat/berhenti).
function accentFor(status: Arrival['status']): string {
  if (status === 'arriving') return 'var(--tertiary)'
  if (status === 'delayed' || status === 'stopped') return 'var(--error)'
  return 'var(--primary)'
}

export default function ArrivalCard({ arrival: a, index }: ArrivalCardProps) {
  const isPrimary = a.route_type === 'Main Line'
  const isStopped = a.status === 'stopped'

  return (
    <div
      className={`${styles.card} ${a.just_passed ? styles.cardPassed : ''} ${
        isStopped ? styles.cardStopped : ''
      }`}
      style={
        {
          animationDelay: `${index * 80}ms`,
          '--accent': accentFor(a.status),
        } as React.CSSProperties
      }
    >
      <div className={styles.left}>
        <div
          className={styles.routeBadge}
          style={{
            backgroundColor: isPrimary ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(var(--secondary-rgb), 0.1)',
          }}
        >
          <span
            className={styles.routeCode}
            style={{ color: isPrimary ? 'var(--primary)' : 'var(--secondary)' }}
          >
            {a.route_code}
          </span>
        </div>

        <div className={styles.info}>
          <span className={styles.busName}>
            {a.bus_name}
            {a.is_next && <span className={styles.nextBadge}>BERIKUTNYA</span>}
          </span>
          <span className={styles.routeMeta}>
            {a.just_passed ? 'Baru dilewati' : `${a.route_name} • ${a.distance_km} km`}
          </span>
        </div>
      </div>

      <div className={styles.right}>
        {isStopped ? (
          // Bus berhenti: JANGAN tampilkan angka menit apa pun. Angka di sini akan
          // terbaca sebagai janji kedatangan, padahal bus tidak sedang menuju kemari.
          <>
            <span className={styles.stoppedLabel}>Bus berhenti</span>
            {a.stopped_seconds != null && (
              <span className={styles.stoppedSince}>sudah {formatDuration(a.stopped_seconds)}</span>
            )}
          </>
        ) : (
          <>
            <span
              className={styles.etaNumber}
              style={{
                color:
                  a.status === 'arriving'
                    ? 'var(--on-tertiary-container)'
                    : a.status === 'delayed'
                      ? 'var(--error)'
                      : 'var(--on-surface)',
              }}
            >
              {a.status === 'arriving' ? '~1' : a.eta_minutes}
            </span>
            <span className={styles.etaUnit}>{a.status === 'arriving' ? 'ARRIVING' : 'MINS'}</span>
          </>
        )}
      </div>
    </div>
  )
}
