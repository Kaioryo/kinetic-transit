/**
 * Rebuild Route Waypoints from a Real GPS Trace — Kinetic Transit
 *
 * Mengganti routes.waypoints dengan jejak GPS ASLI dari sebuah trip lapangan.
 *
 * Kenapa: polyline OSRM (dari fetch-route-waypoints.mjs) memutar di jalan yang
 * TIDAK dilewati odong asli, sehingga jarak-sepanjang-polyline ke halte paruh
 * akhir membengkak 4-5× dan ETA jadi terlalu pesimis (terbukti dari data
 * lapangan: MAE 154 dtk, bias selalu negatif). Karena kita sekarang punya jejak
 * GPS nyata yang menelusuri jalan yang BENAR-BENAR dilalui, jejak itulah geometri
 * paling akurat yang bisa dipakai.
 *
 * Jalankan: npm run rebuild-waypoints -- --trip=34 [--route=1]
 * Membalikkan: npm run fetch-waypoints  (kembali ke polyline OSRM)
 */

import { PrismaClient } from '@prisma/client'
import { haversineKm, closestWaypointIndex } from '../lib/eta-engine.mjs'

const prisma = new PrismaClient()

function argValue(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const TRIP_ID = parseInt(argValue('trip'), 10)
if (!Number.isFinite(TRIP_ID)) {
  console.error('❌ Wajib: --trip=<id>. Contoh: npm run rebuild-waypoints -- --trip=34')
  process.exit(1)
}

// Parameter pembersihan jejak (GPS odong ~tiap 2 detik).
const THIN_M = 8 // buang titik < 8m dari titik terakhir → hapus gumpalan saat ngetem
const MAX_JUMP_M = 300 // lompatan > 300m dalam 1 langkah = glitch GPS, dibuang

// Panjang total polyline (km).
function loopLengthKm(pts) {
  let sum = 0
  for (let i = 1; i < pts.length; i++) {
    sum += haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng)
  }
  return sum
}

// Jarak maju sepanjang polyline dari satu halte ke halte berikutnya (melingkar).
function alongGap(stopA, stopB, waypoints) {
  const n = waypoints.length
  const cum = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + haversineKm(
      waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng
    )
  }
  const total = cum[n - 1]
  const ia = closestWaypointIndex(stopA.lat, stopA.lng, waypoints)
  const ib = closestWaypointIndex(stopB.lat, stopB.lng, waypoints)
  let d = cum[ib] - cum[ia]
  if (d < 0) d += total
  return d
}

// Jarak snap terkecil dari sebuah halte ke titik polyline terdekat (meter).
function snapDistanceM(stop, waypoints) {
  const idx = closestWaypointIndex(stop.lat, stop.lng, waypoints)
  return haversineKm(stop.lat, stop.lng, waypoints[idx].lat, waypoints[idx].lng) * 1000
}

async function main() {
  const trip = await prisma.trips.findUnique({ where: { id: TRIP_ID } })
  if (!trip) {
    console.error(`❌ Trip ${TRIP_ID} tidak ditemukan.`)
    process.exit(1)
  }
  const routeId = parseInt(argValue('route', String(trip.route_id)), 10)

  const route = await prisma.routes.findUnique({
    where: { id: routeId },
    include: { route_stops: { include: { stops: true }, orderBy: { stop_order: 'asc' } } },
  })
  const stops = route.route_stops.map((rs) => ({
    name: rs.stops.name,
    lat: Number(rs.stops.latitude),
    lng: Number(rs.stops.longitude),
  }))

  const oldWaypoints = Array.isArray(route.waypoints) ? route.waypoints : null

  // 1. Ambil jejak GPS mentah trip, urut waktu.
  const raw = await prisma.bus_locations.findMany({
    where: { trip_id: TRIP_ID },
    orderBy: { recorded_at: 'asc' },
    select: { latitude: true, longitude: true },
  })
  console.log(`Trip ${TRIP_ID} (rute "${route.name}"): ${raw.length} titik GPS mentah`)

  // 2. Bersihkan: buang glitch + tipiskan gumpalan diam.
  const pts = []
  let dropGlitch = 0
  let dropThin = 0
  for (const r of raw) {
    const p = { lat: Number(r.latitude), lng: Number(r.longitude) }
    if (pts.length === 0) {
      pts.push(p)
      continue
    }
    const last = pts[pts.length - 1]
    const dM = haversineKm(last.lat, last.lng, p.lat, p.lng) * 1000
    if (dM > MAX_JUMP_M) {
      dropGlitch++
      continue
    }
    if (dM < THIN_M) {
      dropThin++
      continue
    }
    pts.push(p)
  }

  // 3. Tutup loop (rute melingkar): titik akhir kembali ke titik awal.
  const gapCloseM = haversineKm(pts[0].lat, pts[0].lng, pts[pts.length - 1].lat, pts[pts.length - 1].lng) * 1000
  if (gapCloseM > THIN_M) pts.push({ lat: pts[0].lat, lng: pts[0].lng })

  console.log(
    `Dibersihkan → ${pts.length} titik ` +
      `(buang ${dropGlitch} glitch, ${dropThin} terlalu rapat) | jarak tutup-loop ${Math.round(gapCloseM)}m`
  )
  if (pts.length < 20) {
    console.error(`❌ Terlalu sedikit titik (${pts.length}) — jejak tidak layak. Batal.`)
    process.exit(1)
  }

  // 4. Bandingkan geometri LAMA vs BARU sebelum menulis.
  console.log(`\nPanjang loop  : LAMA ${oldWaypoints ? loopLengthKm(oldWaypoints).toFixed(2) : 'n/a'} km  →  BARU ${loopLengthKm(pts).toFixed(2)} km`)
  const maxSnap = Math.max(...stops.map((s) => snapDistanceM(s, pts)))
  console.log(`Snap halte→jejak terjauh (BARU): ${Math.round(maxSnap)}m (makin kecil makin baik)`)

  console.log(`\nJarak antar-halte sepanjang polyline (meter) — LAMA vs BARU:`)
  for (let i = 0; i < stops.length; i++) {
    const a = stops[i]
    const b = stops[(i + 1) % stops.length]
    const dOld = oldWaypoints ? Math.round(alongGap(a, b, oldWaypoints) * 1000) : null
    const dNew = Math.round(alongGap(a, b, pts) * 1000)
    const flag = dOld && dOld > 2 * dNew ? '  ⬅ dulu membengkak' : ''
    console.log(
      `  ${a.name.padEnd(26).slice(0, 26)} → ${b.name.padEnd(22).slice(0, 22)} : ` +
        `${String(dOld ?? '—').padStart(5)}  →  ${String(dNew).padStart(5)}${flag}`
    )
  }

  // 5. Tulis.
  if (argValue('dry') != null) {
    console.log(`\n(dry-run: routes.waypoints TIDAK diubah)`)
  } else {
    await prisma.routes.update({ where: { id: routeId }, data: { waypoints: pts } })
    console.log(`\n✅ routes.waypoints rute "${route.name}" diganti dengan jejak asli (${pts.length} titik).`)
    console.log(`   Balikkan dengan: npm run fetch-waypoints`)
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
