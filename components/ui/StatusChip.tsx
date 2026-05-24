'use client'

import styles from './StatusChip.module.css'

export default function StatusChip() {
  return (
    <div className={styles.chip}>
      <span className={styles.dot} />
      <span className={styles.text}>Live</span>
    </div>
  )
}
