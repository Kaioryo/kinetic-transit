'use client'

import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <svg
          className={styles.logo}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 15V8.5C4 5.46 6.46 3 9.5 3H14.5C17.54 3 20 5.46 20 8.5V15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 15C4 16.1 4.9 17 6 17H18C19.1 17 20 16.1 20 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="8" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 11H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 3V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <h1 className={styles.title}>Kinetic Transit</h1>
      </div>
      <div className={styles.right}>
        <button className={styles.iconButton} aria-label="My location" title="My Location">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}
