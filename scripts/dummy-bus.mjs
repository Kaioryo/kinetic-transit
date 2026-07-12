/**
 * Dummy Bus Simulator — Kinetic Transit
 *
 * Pengganti ESP32 untuk menguji ETA tanpa mikrokontroler.
 * Setiap trip aktif digerakkan mengikuti POLYLINE JALAN ASLI rutenya
 * (routes.waypoints hasil OSRM) bila tersedia, atau fallback ke garis lurus
 * antar HALTE (route_stops) bila belum. Koordinatnya ditulis ke tabel
 * bus_locations — sama seperti yang dilakukan mqtt-bridge saat menerima GPS asli.
 *
 * ETA tidak dihitung di sini; GET /api/live yang menghitungnya on-read.
 *
 * Jalankan dengan: node --env-file=.env scripts/dummy-bus.mjs
 *
 * OPSI SIMULASI GANGGUAN (untuk menguji perilaku ETA saat bus bermasalah):
 *
 *   --stall=<tripId>[,<tripId>]   Bus MOGOK: berhenti bergerak tapi TETAP mengirim
 *                                 posisi dengan speed 0. Ini persis kondisi yang
 *                                 berbahaya — GPS hidup, bus mati — sehingga is_stale
 *                                 tidak menangkapnya. ETA harus jadi null/"berhenti",
 *                                 bukan angka menit yang optimis.
 *   --slow=<km/jam>               Bus MACET: semua bus merayap di kecepatan ini
 *                                 (tetap bergerak). ETA harus MEMBESAR, dan bus tidak
 *                                 boleh salah dicap "berhenti".
 *
 * Contoh: node --env-file=.env scripts/dummy-bus.mjs --stall=13
 */

import { PrismaClient } from '@prisma/client'
import { createLoggerState, processLocation } from '../lib/eta-logger.mjs'

const prisma = new PrismaClient()
const loggerState = createLoggerState()

const TICK_MS = 3000        // interval kirim posisi (mirip ESP32 ~3 detik)
const MIN_SPEED = 15        // km/jam
const MAX_SPEED = 25        // km/jam

// ─── Opsi CLI ───────────────────────────────────────────────────────────────
function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

const STALLED_TRIPS = new Set(
  (argValue('stall') ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
)
const SLOW_KMH = argValue('slow') != null ? parseFloat(argValue('slow')) : null

// ─── Util geometri (inline, karena ini script node murni) ──────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// State per trip: posisi di sepanjang rangkaian titik (waypoint jalan / halte).
// { path: [{lat,lng}], source: 'waypoints'|'stops', segIndex, progress }
const tripStates = new Map()

/** Validasi kolom waypoints (Json) → array {lat,lng}. */
function parseWaypoints(raw) {
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

async function loadActiveTrips() {
  const trips = await prisma.trips.findMany({
    where: { status: 'active' },
    include: {
      buses: true,
      routes: {
        include: {
          route_stops: {
            include: { stops: true },
            orderBy: { stop_order: 'asc' },
          },
        },
      },
    },
  })

  const usable = []
  for (const trip of trips) {
    // Halte lengkap (dengan id & nama) untuk pergerakan sekaligus logging ETA.
    const stops = trip.routes.route_stops.map((rs) => ({
      stop_id: rs.stop_id,
      name: rs.stops.name,
      lat: Number(rs.stops.latitude),
      lng: Number(rs.stops.longitude),
    }))
    const pathStops = stops.map((s) => ({ lat: s.lat, lng: s.lng }))

    // Utamakan polyline jalan asli; fallback ke garis lurus antar halte.
    const waypoints = parseWaypoints(trip.routes.waypoints)
    const path = waypoints ?? pathStops
    const source = waypoints ? 'waypoints' : 'stops'

    if (path.length < 2) {
      console.warn(`⚠️  Trip ${trip.id} (${trip.buses.name}) punya <2 titik jalur, dilewati.`)
      continue
    }
    if (!tripStates.has(trip.id)) {
      tripStates.set(trip.id, { path, source, stops, waypoints, segIndex: 0, progress: 0 })
    } else {
      // segarkan jalur kalau rute/waypoint berubah
      const st = tripStates.get(trip.id)
      st.path = path
      st.source = source
      st.stops = stops
      st.waypoints = waypoints
      if (st.segIndex >= path.length) st.segIndex = 0
    }
    usable.push(trip)
  }
  return usable
}

async function tick(trips) {
  for (const trip of trips) {
    const state = tripStates.get(trip.id)
    if (!state) continue

    const path = state.path
    const stalled = STALLED_TRIPS.has(trip.id)

    // Bus mogok: kecepatan 0 dan posisi tidak maju sedikit pun — tapi GPS-nya TETAP
    // mengirim, jadi dari sisi server bus ini terlihat "hidup". Justru itu ujiannya.
    const speed = stalled ? 0 : SLOW_KMH ?? MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
    let remainingKm = speed * (TICK_MS / 3_600_000) // km yang ditempuh per tick

    // Maju sepanjang path (bisa melompati beberapa segmen pendek dalam 1 tick,
    // penting karena waypoint jalan bisa berjarak hanya ~15-25m).
    let guard = 0
    while (remainingKm > 0 && guard++ < path.length * 2) {
      const a = path[state.segIndex]
      const b = path[(state.segIndex + 1) % path.length]
      const segKm = haversineKm(a.lat, a.lng, b.lat, b.lng)
      const remainOnSeg = segKm * (1 - state.progress)

      if (segKm === 0) {
        state.progress = 0
        state.segIndex = (state.segIndex + 1) % path.length
        continue
      }
      if (remainingKm >= remainOnSeg) {
        remainingKm -= remainOnSeg
        state.progress = 0
        state.segIndex = (state.segIndex + 1) % path.length
      } else {
        state.progress += remainingKm / segKm
        remainingKm = 0
      }
    }

    // Interpolasi posisi di sepanjang segmen aktif.
    const a = path[state.segIndex]
    const b = path[(state.segIndex + 1) % path.length]
    const t = Math.min(state.progress, 1)
    const lat = a.lat + (b.lat - a.lat) * t
    const lng = a.lng + (b.lng - a.lng) * t

    await prisma.bus_locations.create({
      data: {
        trip_id: trip.id,
        latitude: lat,
        longitude: lng,
        speed: Math.round(speed * 100) / 100,
        recorded_at: new Date(),
      },
    })

    // Catat prediksi & deteksi kedatangan untuk evaluasi akurasi ETA.
    await processLocation(prisma, {
      tripId: trip.id,
      lat,
      lng,
      stops: state.stops,
      waypoints: state.waypoints,
      state: loggerState,
    })

    console.log(
      `${stalled ? '⏸' : '🚌'} ${trip.buses.name} (trip ${trip.id}) [${state.source}] → lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} | ${speed.toFixed(1)} km/j${stalled ? ' MOGOK' : ''} | seg ${state.segIndex}/${path.length}`
    )
  }
}

// ─── Main loop ─────────────────────────────────────────────────────────────
let running = true

async function main() {
  console.log('🎮 Dummy Bus Simulator dimulai. Ctrl+C untuk berhenti.')
  let trips = await loadActiveTrips()

  if (trips.length === 0) {
    console.warn('⚠️  Tidak ada trip aktif. Pastikan DB sudah di-seed & ada trip status="active".')
  } else {
    console.log(`✅ Menggerakkan ${trips.length} bus di sepanjang halte aslinya.`)
    console.log(`   Trip aktif: ${trips.map((t) => `${t.id}=${t.buses.name}`).join(', ')}`)
  }
  if (STALLED_TRIPS.size > 0) {
    console.log(`⏸  Simulasi MOGOK untuk trip: ${[...STALLED_TRIPS].join(', ')} (GPS tetap kirim, speed 0)`)
  }
  if (SLOW_KMH != null) {
    console.log(`🐢 Simulasi MACET: semua bus merayap ${SLOW_KMH} km/jam`)
  }

  let sinceReload = 0
  while (running) {
    try {
      // Muat ulang daftar trip tiap ~30 detik (menangkap trip baru).
      if (sinceReload >= 10) {
        trips = await loadActiveTrips()
        sinceReload = 0
      }
      if (trips.length > 0) await tick(trips)
    } catch (err) {
      console.error('❌ Tick gagal:', err.message)
    }
    sinceReload++
    await new Promise((r) => setTimeout(r, TICK_MS))
  }
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Menghentikan Dummy Bus Simulator...')
  running = false
  await prisma.$disconnect()
  process.exit(0)
})

main()
