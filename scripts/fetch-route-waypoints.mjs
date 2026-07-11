/**
 * Fetch Route Waypoints (OSRM) — Kinetic Transit
 *
 * Script SEKALI JALAN. Untuk tiap rute, ambil urutan halte (route_stops),
 * minta OSRM merutekan sepanjang jalan asli, lalu simpan polyline hasilnya
 * (array {lat,lng}) ke kolom routes.waypoints.
 *
 * Dipakai oleh perhitungan ETA "sepanjang jalan" di /api/live (Opsi B) dan
 * oleh dummy-bus untuk bergerak menyusuri jalan.
 *
 * Jalankan sekali: node --env-file=.env scripts/fetch-route-waypoints.mjs
 * Jalankan ulang hanya bila urutan/halte rute berubah.
 *
 * Catatan: memakai OSRM demo server publik (router.project-osrm.org) — cukup
 * untuk kebutuhan ini (beberapa panggilan sekali jalan), bukan untuk produksi.
 *
 * (Profil "foot" via routing.openstreetmap.de sempat dicoba tapi datanya
 * lebih buruk untuk area ini — jarak snap halte->polyline melonjak ke
 * 400m+, artinya jalur pejalan kaki OSM di kampus ini tidak lengkap.
 * Kembali ke profil "driving" yang snap-nya jauh lebih baik (~30-60m).)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

async function fetchRoutePolyline(coords) {
  // coords: array {lat,lng}. OSRM memakai urutan lng,lat.
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(';')
  const url = `${OSRM_BASE}/${path}?geometries=geojson&overview=full`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
    throw new Error(`OSRM code=${data.code || 'unknown'}`)
  }
  // geometry.coordinates: array [lng, lat] → ubah ke {lat, lng}
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
}

async function main() {
  console.log('🗺️  Mengambil polyline jalan asli per rute dari OSRM...\n')

  const routes = await prisma.routes.findMany({
    include: {
      route_stops: {
        include: { stops: true },
        orderBy: { stop_order: 'asc' },
      },
    },
    orderBy: { id: 'asc' },
  })

  for (const route of routes) {
    const stops = route.route_stops.map((rs) => ({
      lat: Number(rs.stops.latitude),
      lng: Number(rs.stops.longitude),
    }))

    if (stops.length < 2) {
      console.warn(`⚠️  Rute "${route.name}" punya <2 halte, dilewati.`)
      continue
    }

    // Rute melingkar: tutup loop dengan menambahkan halte pertama di akhir,
    // agar OSRM juga merutekan segmen kembali ke titik awal.
    const loop = [...stops, stops[0]]

    try {
      const waypoints = await fetchRoutePolyline(loop)
      await prisma.routes.update({
        where: { id: route.id },
        data: { waypoints },
      })
      console.log(
        `✅ "${route.name}": ${stops.length} halte → ${waypoints.length} titik polyline tersimpan.`
      )
    } catch (err) {
      console.error(`❌ "${route.name}": gagal ambil OSRM (${err.message}). Kolom waypoints dibiarkan kosong (ETA fallback ke Opsi A).`)
    }

    // jeda kecil agar sopan ke demo server publik
    await new Promise((r) => setTimeout(r, 1000))
  }

  await prisma.$disconnect()
  console.log('\nSelesai.')
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
