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

// ── Konstanta model kecepatan ────────────────────────────────────────────────
// CATATAN: semua angka di bawah ini masih tebakan awal. Kalibrasi ulang setelah
// ESP32 berjalan di lapangan, pakai data di tabel `eta_logs`.

/** Jendela rata-rata kecepatan. ESP32 kirim tiap ~2 detik → ~90 sampel per jendela. */
export const SPEED_WINDOW_MS = 180_000
/**
 * Lama bus harus diam sebelum benar-benar disebut "berhenti" (bukan sekadar ngetem).
 * HARUS lebih kecil dari SPEED_WINDOW_MS: deteksi diam mengukur rentang waktu antar
 * sampel DI DALAM jendela kecepatan, jadi rentang itu tidak akan pernah mencapai
 * SPEED_WINDOW_MS. Kalau keduanya disamakan, bus mogok tidak akan pernah terdeteksi.
 */
export const STALL_WINDOW_MS = 120_000
/** Di bawah kecepatan ini bus dianggap tidak bergerak (km/jam). */
export const STALL_SPEED_KMH = 2
/** Perpindahan maksimum yang masih dianggap "diam di tempat" (km). */
export const STALL_RADIUS_KM = 0.04
/** Sejauh mana ditelusuri mundur untuk mengukur SUDAH BERAPA LAMA bus berhenti. */
export const STALL_LOOKBACK_MS = 1_800_000
/** Lantai kecepatan untuk bus yang MERAYAP tapi masih jalan — bukan untuk bus yang berhenti. */
export const MIN_SPEED_KMH = 5
/** HANYA dipakai kalau tidak ada data kecepatan sama sekali (bukan untuk nol yang terukur). */
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

/**
 * ETA (menit, minimal 1) dari jarak & kecepatan rata-rata perjalanan.
 *
 * `speedKmh` HARUS sudah bersih (hasil getMovementProfile). Fungsi ini tidak
 * lagi menerjemahkan 0 → DEFAULT_SPEED_KMH: nol yang TERUKUR berarti bus tidak
 * bergerak, dan itu informasi — bukan ketiadaan data. Kasus bus benar-benar
 * berhenti ditangani pemanggil lewat `isStopped` (ETA tidak dihitung sama
 * sekali), bukan ditambal di sini dengan asumsi optimis.
 */
export function etaMinutesFor(distanceKm, speedKmh) {
  return Math.max(1, Math.round((distanceKm / Math.max(speedKmh, MIN_SPEED_KMH)) * 60))
}

/**
 * Profil gerak satu trip dalam SPEED_WINDOW_MS terakhir.
 *
 * ETA tidak butuh "bus sekarang berapa km/jam" (itu kecepatan sesaat), melainkan
 * "rata-rata kecepatan sepanjang perjalanan, TERMASUK berhenti-berhentinya".
 * Merata-ratakan seluruh sampel dalam jendela waktu memberi persis angka itu:
 * ngetem di halte dan lampu merah ikut terserap ke dalam rata-rata.
 *
 * Jendela berbasis WAKTU (bukan jumlah baris) supaya hasilnya tidak berubah
 * kalau cadence pengiriman ESP32 diubah.
 *
 * → { speedKmh, isStopped, stoppedSeconds, sampleCount }
 */
export async function getMovementProfile(prisma, tripId, now = Date.now()) {
  // Urut menaik: rows[0] = tertua, rows[last] = terbaru.
  const rows = await prisma.bus_locations.findMany({
    where: { trip_id: tripId, recorded_at: { gte: new Date(now - SPEED_WINDOW_MS) } },
    orderBy: { recorded_at: 'asc' },
  })

  const empty = {
    speedKmh: DEFAULT_SPEED_KMH,
    isStopped: false,
    stoppedSeconds: null,
    sampleCount: rows.length,
  }
  if (rows.length === 0) return empty

  const oldest = rows[0]
  const newest = rows[rows.length - 1]
  const spanMs = (newest.recorded_at?.getTime() ?? now) - (oldest.recorded_at?.getTime() ?? now)
  const displacementKm = haversineKm(
    Number(oldest.latitude),
    Number(oldest.longitude),
    Number(newest.latitude),
    Number(newest.longitude)
  )

  // Kecepatan: utamakan kolom `speed` dari GPS (Doppler — akurat & bersih).
  const speeds = rows.map((r) => r.speed).filter((s) => s != null).map(Number)

  let speedKmh
  if (speeds.length > 0) {
    speedKmh = speeds.reduce((a, b) => a + b, 0) / speeds.length
  } else if (spanMs > 0) {
    // ESP32 tidak mengirim `speed` → turunkan dari perpindahan posisi.
    speedKmh = displacementKm / (spanMs / 3_600_000)
  } else {
    return empty // tidak ada data kecepatan maupun rentang waktu untuk menurunkannya
  }

  // Berhenti = diam cukup lama, dilihat dari DUA sumber yang harus sepakat
  // (posisi tidak berpindah DAN kecepatan ~nol), supaya satu sensor yang rusak
  // tidak bisa sendirian membuat bus salah dicap berhenti.
  const spanLongEnough = spanMs >= STALL_WINDOW_MS
  const positionSaysStopped = displacementKm < STALL_RADIUS_KM
  const speedSaysStopped = speeds.length === 0 || Math.max(...speeds) <= STALL_SPEED_KMH
  const isStopped = spanLongEnough && positionSaysStopped && speedSaysStopped

  return {
    speedKmh,
    isStopped,
    stoppedSeconds: isStopped ? await stoppedSecondsFor(prisma, tripId, newest, now) : null,
    sampleCount: rows.length,
  }
}

/**
 * Sudah berapa lama bus diam di titik ini? Jendela kecepatan cuma 3 menit, jadi
 * kalau durasinya diambil dari situ, bus yang mogok 20 menit akan salah dilaporkan
 * "berhenti 3 menit". Maka ditelusuri mundur sampai STALL_LOOKBACK_MS untuk mencari
 * lokasi TERAKHIR yang posisinya masih jauh dari posisi sekarang — di situlah bus
 * berhenti. Hanya dipanggil untuk bus yang memang sudah terdeteksi berhenti.
 */
async function stoppedSecondsFor(prisma, tripId, newest, now) {
  const rows = await prisma.bus_locations.findMany({
    where: { trip_id: tripId, recorded_at: { gte: new Date(now - STALL_LOOKBACK_MS) } },
    orderBy: { recorded_at: 'desc' },
    select: { latitude: true, longitude: true, recorded_at: true },
  })

  const here = { lat: Number(newest.latitude), lng: Number(newest.longitude) }
  let oldestSeen = now
  for (const r of rows) {
    oldestSeen = r.recorded_at?.getTime() ?? oldestSeen
    const moved = haversineKm(here.lat, here.lng, Number(r.latitude), Number(r.longitude))
    if (moved >= STALL_RADIUS_KM) {
      // Baris pertama (dari yang terbaru) yang posisinya sudah jauh → saat bus masih jalan.
      return Math.max(0, Math.round((now - (r.recorded_at?.getTime() ?? now)) / 1000))
    }
  }
  // Tidak ada satu pun baris yang posisinya jauh: bus sudah diam sepanjang riwayat yang
  // kita punya. Kita TIDAK tahu kapan persisnya ia berhenti, jadi laporkan batas bawah
  // yang jujur — sejak baris tertua yang ada — bukan mengarang angka selebar lookback.
  return Math.max(0, Math.round((now - oldestSeen) / 1000))
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
