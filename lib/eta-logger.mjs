/**
 * ETA Logger — mencatat prediksi vs kedatangan aktual untuk evaluasi akurasi.
 *
 * Dipanggil dari sisi ingestion (mqtt-bridge / dummy-bus) setiap kali ada
 * lokasi baus baru. Alurnya per trip:
 *   1. Saat bus "berangkat" dari halte (halte target berikutnya ditetapkan),
 *      catat SATU prediksi: predicted_arrival = now + ETA ke halte target.
 *   2. Saat bus benar-benar TIBA di halte target (jarak < threshold), isi
 *      actual_arrival & error_seconds pada baris prediksi tadi, lalu majukan
 *      target ke halte berikutnya dan buka prediksi baru.
 *
 * Hasilnya: satu pasang (prediksi, aktual) per halte per putaran di tabel
 * `eta_logs` — bahan mentah evaluasi akurasi (mean error, dsb) untuk laporan.
 *
 * Bus yang sedang BERHENTI tidak menghasilkan prediksi: ETA dari kecepatan nol
 * tidak bermakna dan hanya mengotori data. Lihat openPrediction di bawah.
 */

import { haversineKm, stopDistances, etaSecondsFor, getMovementProfile } from './eta-engine.mjs'

// Ambang "tiba" di halte. 80m: cukup longgar untuk mentolerir jarak snap
// polyline↔halte (≤~60m) saat pakai dummy bus; bus GPS asli akan jauh lebih dekat.
const ARRIVAL_THRESHOLD_KM = 0.08

/** State logger lintas-tick (satu Map dipakai untuk semua trip pada 1 proses). */
export function createLoggerState() {
  return new Map()
}

/**
 * @param prisma  PrismaClient
 * @param opts    { tripId, lat, lng, stops, waypoints, state, source }
 *   stops: [{stop_id, name, lat, lng}] terurut; waypoints: array|null
 *   source: 'field' (GPS ESP32 asli) | 'simulated' (dummy-bus). WAJIB benar —
 *           hanya baris 'field' yang sah dipakai sebagai angka akurasi di laporan.
 */
export async function processLocation(
  prisma,
  { tripId, lat, lng, stops, waypoints, state, source = 'simulated' }
) {
  if (!stops || stops.length < 2) return

  let st = state.get(tripId)

  // Inisialisasi: tetapkan halte target = halte SETELAH yang terdekat saat ini.
  if (!st) {
    let nearest = 0
    let nd = Infinity
    for (let i = 0; i < stops.length; i++) {
      const d = haversineKm(lat, lng, stops[i].lat, stops[i].lng)
      if (d < nd) {
        nd = d
        nearest = i
      }
    }
    st = { nextIdx: (nearest + 1) % stops.length, openLogId: null, persistedTargetId: null }
    state.set(tripId, st)
    await openPrediction(prisma, { tripId, lat, lng, stops, waypoints, st, source })
    return
  }

  const target = stops[st.nextIdx]
  const distToTarget = haversineKm(lat, lng, target.lat, target.lng)

  if (distToTarget <= ARRIVAL_THRESHOLD_KM) {
    // Bus tiba di halte target → tutup prediksi terbuka dengan aktual + error.
    if (st.openLogId != null) {
      const row = await prisma.eta_logs.findUnique({ where: { id: st.openLogId } })
      if (row && row.actual_arrival == null) {
        const now = new Date()
        const errSec = Math.round(
          (now.getTime() - new Date(row.predicted_arrival).getTime()) / 1000
        )
        await prisma.eta_logs.update({
          where: { id: st.openLogId },
          data: { actual_arrival: now, error_seconds: errSec },
        })
      }
    }
    // Majukan target & buka prediksi baru untuk halte berikutnya.
    st.nextIdx = (st.nextIdx + 1) % stops.length
    st.openLogId = null
    await openPrediction(prisma, { tripId, lat, lng, stops, waypoints, st, source })
    return
  }

  // Prediksi bisa GAGAL dibuka (bus sedang berhenti — lihat openPrediction).
  // Coba lagi tiap lokasi baru, supaya prediksi otomatis terbuka begitu bus jalan
  // lagi. Tanpa ini, satu halte kehilangan prediksinya selamanya.
  if (st.openLogId == null) {
    await openPrediction(prisma, { tripId, lat, lng, stops, waypoints, st, source })
  }
}

/**
 * Catat satu prediksi kedatangan untuk halte target saat ini + persist ke trips.
 *
 * Fungsi ini dipanggil PERSIS saat bus tiba di sebuah halte — yaitu saat bus
 * sedang paling lambat atau malah diam. Kalau bus memang sedang berhenti, prediksi
 * TIDAK dibuat: ETA yang lahir dari kecepatan nol hanya akan mengotori eta_logs.
 * `st.openLogId` dibiarkan null, dan processLocation akan mencoba lagi tiap ping
 * berikutnya sampai bus benar-benar bergerak.
 */
async function openPrediction(prisma, { tripId, lat, lng, stops, waypoints, st, source }) {
  const target = stops[st.nextIdx]

  // Halte target tetap dipersist walau prediksinya belum bisa dibuat. Ditulis hanya
  // saat targetnya benar-benar berpindah — fungsi ini kini dicoba ulang tiap ping.
  if (st.persistedTargetId !== target.stop_id) {
    await prisma.trips.update({
      where: { id: tripId },
      data: { next_target_stop_id: target.stop_id },
    })
    st.persistedTargetId = target.stop_id
  }

  const movement = await getMovementProfile(prisma, tripId)
  if (movement.isStopped) return

  const dists = stopDistances(lat, lng, stops, waypoints)
  const match = dists.find((d) => d.stop_id === target.stop_id)
  const distanceKm = match ? match.distanceKm : haversineKm(lat, lng, target.lat, target.lng)

  // DETIK, bukan menit: pembulatan ke menit (lantai 1 menit) akan merusak evaluasi,
  // karena waktu tempuh antar-halte di sini sering hanya 20-40 detik. Tampilan boleh
  // membulatkan; pengukuran tidak boleh.
  const etaSec = etaSecondsFor(distanceKm, movement.speedKmh)
  const predictedArrival = new Date(Date.now() + etaSec * 1000)

  const row = await prisma.eta_logs.create({
    data: {
      trip_id: tripId,
      stop_id: target.stop_id,
      predicted_at: new Date(),
      predicted_arrival: predictedArrival,
      source,
    },
  })
  st.openLogId = row.id
}
