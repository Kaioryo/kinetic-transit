'use client'

import { ETAInfo } from '@/lib/types'
import ETACard from './ETACard'
import styles from './ETACardList.module.css'

interface ETACardListProps {
  etas: ETAInfo[]
}

export default function ETACardList({ etas }: ETACardListProps) {
  if (etas.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🚌</span>
        <p className={styles.emptyText}>Waiting for shuttle data...</p>
        <p className={styles.emptySubtext}>Shuttles will appear here shortly</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {etas.map((eta, index) => (
        <ETACard
          key={`${eta.shuttle_id}-${eta.stop_id}`}
          eta={eta}
          index={index}
        />
      ))}
    </div>
  )
}
