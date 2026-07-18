/**
 * Ikon SVG bersama — pengganti emoji yang dipakai sebagai ikon di seluruh app.
 *
 * Emoji dirender lewat font sistem operasi, jadi bentuknya beda-beda di tiap
 * platform/browser (Windows/Android/iOS/macOS semua punya gaya emoji sendiri)
 * dan tidak bisa diwarnai lewat `currentColor`. SVG di sini konsisten di semua
 * perangkat dan otomatis ikut warna teks di sekitarnya.
 */

interface IconProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/** Pengganti 🚌 — bus, badan + jendela + dua roda. */
export function BusIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      <rect x="3" y="4" width="18" height="13" rx="3" fill="currentColor" />
      <rect x="5.5" y="6.5" width="13" height="4" rx="1" fill="#fff" fillOpacity="0.9" />
      <circle cx="7.5" cy="19" r="2" fill="currentColor" />
      <circle cx="16.5" cy="19" r="2" fill="currentColor" />
    </svg>
  )
}

/** Markup SVG mentah dari BusIcon — untuk konteks non-React (Leaflet divIcon
 *  yang butuh string HTML, bukan komponen). Sumber visualnya sama persis. */
export function busIconMarkup(size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="13" rx="3" fill="currentColor"/>
    <rect x="5.5" y="6.5" width="13" height="4" rx="1" fill="#fff" fill-opacity="0.9"/>
    <circle cx="7.5" cy="19" r="2" fill="currentColor"/>
    <circle cx="16.5" cy="19" r="2" fill="currentColor"/>
  </svg>`
}

/** Pengganti 📍 — pin lokasi/koordinat. */
export function PinIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.5 6.5 12 7 12.5.5-.5 7-7 7-12.5C18.5 5.36 15.14 2 12 2zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z" />
    </svg>
  )
}

/** Pengganti 🚏 — halte (ring+titik, meniru gaya marker halte di peta). */
export function StopIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  )
}

/** Pengganti ⚠️/⚠ — peringatan. */
export function WarningIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 3L2 20h20L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 9.5v4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

/** Pengganti ⏸ — jeda. */
export function PauseIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

/** Pengganti ▶ — putar. */
export function PlayIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

/** Pengganti ✕ — tutup. */
export function CloseIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Pengganti 📡 — sinyal terputus (wifi disilang). */
export function WifiOffIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M2 8.82a15 15 0 0 1 20 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <path d="M5 12.5a10 10 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <path d="M8.5 16a5 5 0 0 1 7 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <circle cx="12" cy="19" r="1.3" fill="currentColor" />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
