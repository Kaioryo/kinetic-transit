'use client'

import { useState } from 'react'
import styles from './AboutModal.module.css'

export default function AboutModal() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Tombol "?" di Header */}
      <button
        className={styles.triggerButton}
        onClick={() => setIsOpen(true)}
        aria-label="Tentang Aplikasi"
        title="Tentang Aplikasi"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.22 13.69 11.25 12.58 11.6C12.24 11.71 12 12.03 12 12.38V13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1" fill="currentColor" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modal Panel */}
      <div
        className={`${styles.modal} ${isOpen ? styles.modalVisible : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Tentang Kinetic Transit"
      >
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <div className={styles.modalIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 15V8.5C4 5.46 6.46 3 9.5 3H14.5C17.54 3 20 5.46 20 8.5V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 15C4 16.1 4.9 17 6 17H18C19.1 17 20 16.1 20 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="8" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="16" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 11H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 3V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 className={styles.modalTitle}>Kinetic Transit</h2>
              <p className={styles.modalSubtitle}>Sistem Monitoring Shuttle Kampus Unpad</p>
            </div>
          </div>
          <button
            className={styles.closeButton}
            onClick={() => setIsOpen(false)}
            aria-label="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Modal Body */}
        <div className={styles.modalBody}>

          {/* Badge Tugas Akhir */}
          <div className={styles.badgeRow}>
            <span className={styles.badge}>Tugas Akhir / Skripsi</span>
          </div>

          <p className={styles.description}>
            Aplikasi ini dikembangkan sebagai bagian dari penelitian Tugas Akhir untuk memantau
            posisi armada shuttle kampus Universitas Padjadjaran secara <em>real-time</em> berbasis
            Progressive Web App (PWA) yang terintegrasi dengan teknologi Internet of Things (IoT).
          </p>

          {/* Info Program Studi */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L2 9L12 15L22 9L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M6 12V17C6 17 8.5 20 12 20C15.5 20 18 17 18 17V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 9V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className={styles.infoCardLabel}>Program Studi</p>
              <p className={styles.infoCardValue}>Teknik Informatika</p>
              <p className={styles.infoCardSub}>FMIPA · Universitas Padjadjaran · 2026</p>
            </div>
          </div>

          {/* Mahasiswa */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Mahasiswa</p>
            <div className={styles.personCard}>
              <div className={styles.personAvatar}>RI</div>
              <div>
                <p className={styles.personName}>Rio Irawan</p>
                <p className={styles.personDetail}>NPM 140810220084</p>
              </div>
            </div>
          </div>

          {/* Pembimbing */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Dosen Pembimbing</p>
            <div className={styles.personCard}>
              <div className={styles.personAvatar}>DS</div>
              <div>
                <p className={styles.personName}>Deni Setiana, S.Si. M.Cs.</p>
                <p className={styles.personDetail}>Pembimbing I</p>
              </div>
            </div>
            <div className={styles.personCard}>
              <div className={styles.personAvatar}>SH</div>
              <div>
                <p className={styles.personName}>Dr. Setiawan Hadi, M.Sc.CS.</p>
                <p className={styles.personDetail}>Pembimbing II</p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <p className={styles.footerText}>© 2026 Kinetic Transit — Universitas Padjadjaran</p>
        </div>
      </div>
    </>
  )
}
