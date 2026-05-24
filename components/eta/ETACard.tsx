'use client'

import { ETAInfo } from '@/lib/types'
import styles from './ETACard.module.css'

interface ETACardProps {
  eta: ETAInfo
  index: number
}

export default function ETACard({ eta, index }: ETACardProps) {
  const isPrimary = eta.route_id === 'JTN-01'

  return (
    <div
      className={styles.card}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className={styles.left}>
        <div
          className={styles.routeBadge}
          style={{
            backgroundColor: isPrimary
              ? 'rgba(0, 105, 69, 0.1)'
              : 'rgba(76, 93, 110, 0.1)',
          }}
        >
          <span
            className={styles.routeCode}
            style={{
              color: isPrimary ? 'var(--primary)' : 'var(--secondary)',
            }}
          >
            {eta.route_code}
          </span>
        </div>
        <div className={styles.info}>
          <span className={styles.stopName}>{eta.stop_name}</span>
          <span className={styles.routeMeta}>
            Route {eta.route_code} • {eta.route_type}
          </span>
        </div>
      </div>

      <div className={styles.right}>
        <span
          className={styles.etaNumber}
          style={{
            color:
              eta.status === 'arriving'
                ? 'var(--primary)'
                : eta.status === 'delayed'
                  ? 'var(--error)'
                  : 'var(--on-surface)',
          }}
        >
          {eta.status === 'arriving' ? '~1' : eta.eta_minutes}
        </span>
        <span className={styles.etaUnit}>
          {eta.status === 'arriving' ? 'ARRIVING' : 'MINS'}
        </span>
      </div>
    </div>
  )
}
