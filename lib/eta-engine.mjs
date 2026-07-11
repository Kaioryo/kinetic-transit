/**
 * ETA Engine — sumber tunggal perhitungan jarak & ETA.
 *
 * Dipakai bersama oleh:
 *   - app/api/live/route.ts  (menghitung ETA on-read untuk client)
 *   - lib/eta-logger.mjs     (mencatat prediksi untuk evaluasi akurasi)
 *
 * Plain JS (.mjs) agar bisa diimpor baik oleh Next (TS) maupun script node
 * murni (mqtt-bridge / dummy-bus) tanpa duplikasi algoritma.
 */

// Faktor koreksi jarak jalan vs garis lurus — hanya dipakai pada mode fallback.
export const ROAD_FACTOR = 1.3
// Kecepatan minimum & default (km/jam) agar ETA tidak meledak saat bus diam.
export const MIN_SPEED_KMH = 5
export const DEFAULT_SPEED_KMH = 15

/** Jarak dua koordinat (km) via Haversine. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Validasi & normalisasi kolom routes.waypoints (Json) → array {lat,lng} | null. */
export function parseWaypoints(raw) {
  if (!Array.isArray(raw)) return null
  const wps = []
  for (const p of raw) {
    if (p && typeof p === 'object' && typeof p.lat === 'number' && typeof p.lng === 'number') {
      wps.push({ lat: p.lat, lng: p.lng })
    } else {
      return null
    }
  }
  return wps.length >= 2 ? wps : null
}

/** Indeks titik polyline terdekat dari sebuah posisi. */
export function closestWaypointIndex(lat, lng, waypoints) {
  let minDist = Infinity
  let idx = 0
  for (let i = 0; i < waypoints.length; i++) {
    const d = haversineKm(lat, lng, waypoints[i].lat, waypoints[i].lng)
    if (d < minDist) {
      minDist = d
      idx = i
    }
  }
  return idx
}

/**
 * Opsi B: jarak ke tiap halte diukur sepanjang polyline jalan asli (melingkar).
 * stops: [{stop_id, name?, lat, lng}] terurut. → [{stop_id, name, distanceKm}]
 */
export function distancesAlongPolyline(busLat, busLng, stops, waypoints) {
  const n = waypoints.length
  const cum = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    cum[i] =
      cum[i - 1] +
      haversineKm(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng)
  }
  const total = cum[n - 1]
  const busIdx = closestWaypointIndex(busLat, busLng, waypoints)

  return stops.map((s) => {
    const sIdx = closestWaypointIndex(s.lat, s.lng, waypoints)
    let d = cum[sIdx] - cum[busIdx]
    if (d < 0) d += total // maju melingkar: halte di belakang = satu putaran ke depan
    return { stop_id: s.stop_id, name: s.name, distanceKm: d }
  })
}

/** Opsi A (fallback): jarak garis-lurus akumulatif antar halte × road factor. */
export function distancesAlongStops(busLat, busLng, stops) {
  let nearestIdx = 0
  let nearestDist = Infinity
  for (let i = 0; i < stops.length; i++) {
    const d = haversineKm(busLat, busLng, stops[i].lat, stops[i].lng)
    if (d < nearestDist) {
      nearestDist = d
      nearestIdx = i
    }
  }

  const out = []
  let cumulativeKm = 0
  for (let offset = 0; offset < stops.length; offset++) {
    const idx = (nearestIdx + offset) % stops.length
    const cur = stops[idx]
    if (offset === 0) {
      cumulativeKm = haversineKm(busLat, busLng, cur.lat, cur.lng)
    } else {
      const prev = stops[(nearestIdx + offset - 1) % stops.length]
      cumulativeKm += haversineKm(prev.lat, prev.lng, cur.lat, cur.lng)
    }
    out.push({ stop_id: cur.stop_id, name: cur.name, distanceKm: cumulativeKm * ROAD_FACTOR })
  }
  return out
}

/** Pilih metode otomatis: polyline bila ada, else fallback garis-lurus. */
export function stopDistances(busLat, busLng, stops, waypoints) {
  return waypoints
    ? distancesAlongPolyline(busLat, busLng, stops, waypoints)
    : distancesAlongStops(busLat, busLng, stops)
}

/** ETA (menit, minimal 1) dari jarak & kecepatan. */
export function etaMinutesFor(distanceKm, speedKmh) {
  const speed = speedKmh > 0 ? speedKmh : DEFAULT_SPEED_KMH
  return Math.max(1, Math.round((distanceKm / Math.max(speed, MIN_SPEED_KMH)) * 60))
}

/**
 * Hitung ETA ke semua halte untuk satu bus.
 * → [{stop_id, name, distanceKm, etaMinutes}]
 */
export function computeEtas({ busLat, busLng, speedKmh, stops, waypoints }) {
  return stopDistances(busLat, busLng, stops, waypoints).map((d) => ({
    stop_id: d.stop_id,
    name: d.name,
    distanceKm: d.distanceKm,
    etaMinutes: etaMinutesFor(d.distanceKm, speedKmh),
  }))
}
