import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { computeEtas, parseWaypoints, getMovementProfile } from '@/lib/eta-engine.mjs'

// GET /api/live — Query active trips + latest location, and compute ETAs on-read.
//
// ETA dihitung langsung saat request (bukan disimpan ke tabel `etas`), sehingga
// selalu segar. Perhitungan jarak/ETA memakai lib/eta-engine.mjs (sumber tunggal,
// dipakai juga oleh eta-logger untuk evaluasi akurasi):
//   - SEPANJANG POLYLINE JALAN ASLI (routes.waypoints dari OSRM) bila tersedia,
//   - atau FALLBACK ke jarak garis-lurus antar halte (× road factor) bila belum.
// Untuk rute melingkar, halte yang baru dilewati otomatis "jauh" satu putaran.
//
// Kecepatan yang dipakai untuk ETA adalah RATA-RATA beberapa menit terakhir
// (getMovementProfile), bukan kecepatan sesaat. Yang dibutuhkan ETA memang bukan
// "bus sekarang berapa km/jam", melainkan "rata-rata kecepatan sepanjang sisa
// perjalanan, termasuk berhenti-berhentinya" — dan merata-ratakan jendela waktu
// memberi persis itu (ngetem & lampu merah terserap sendiri).
//
// BUS BERHENTI (mogok/macet parah): beda dari bus basi. Di sini GPS-nya SEHAT dan
// terus mengirim — yang mati busnya, bukan radionya, jadi `is_stale` tidak akan
// menangkapnya. Bus seperti ini TIDAK diberi angka ETA sama sekali (eta_minutes
// null, status 'stopped'): menampilkan "6 menit" untuk bus yang tidak akan datang
// jauh lebih merugikan penumpang daripada mengaku tidak tahu.
//
// Penanda is_next / just_passed diturunkan dari jarak polyline yang SAMA dengan
// perhitungan ETA (bukan dari trips.next_target_stop_id milik eta-logger), supaya
// label dan angka ETA tidak pernah bertentangan.
//
// ETA dikelompokkan PER HALTE (bukan per bus): satu halte bisa punya lebih
// dari satu bus mendekat (rute berbeda, atau beberapa bus di rute yang sama)
// — ini supaya panel "Nearby Stops" tetap terbaca meski jumlah bus bertambah.
//
// BUS BASI (stale): kalau ESP32 mati / kehilangan sinyal, lokasi terakhirnya
// tetap ada di DB. Tanpa penjagaan, ETA akan terus dihitung seolah bus masih
// jalan — penumpang menunggu bus yang sudah pulang. Maka bus yang tidak mengirim
// GPS selama STALE_THRESHOLD_MS ditandai `is_stale` dan ETA-nya TIDAK disertakan.

// ESP32 mengirim tiap ~3-5 detik; 45 detik ≈ 9-15 ping terlewat.
const STALE_THRESHOLD_MS = 45_000

type TripWithRoute = Prisma.tripsGetPayload<{
  include: {
    buses: true
    routes: {
      include: {
        route_stops: {
          include: { stops: true }
          orderBy: { stop_order: 'asc' }
        }
      }
    }
  }
}>

type Arrival = {
  shuttle_id: string
  bus_name: string
  route_id: number
  route_code: string
  route_name: string
  route_type: string
  /** null kalau bus berhenti (mogok/macet) — sengaja tidak menebak angka. */
  eta_minutes: number | null
  distance_km: number
  shuttle_speed: number
  status: 'on-time' | 'delayed' | 'arriving' | 'stopped'
  is_next: boolean
  just_passed: boolean
  /** Sudah berapa lama bus berhenti; hanya terisi saat status 'stopped'. */
  stopped_seconds: number | null
}

export async function GET() {
  try {
    // 1. Ambil semua trip aktif + bus + rute (+ waypoints) + halte (terurut).
    const activeTrips: TripWithRoute[] = await prisma.trips.findMany({
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

    // Kumpulan arrival per stop_id, digabung lintas trip/rute.
    const arrivalsByStop = new Map<
      number,
      { stop_name: string; latitude: number; longitude: number; arrivals: Arrival[] }
    >()

    // 2. Untuk tiap trip: ambil lokasi terbaru, lalu bangun shuttle + hitung ETA.
    const shuttles = await Promise.all(
      activeTrips.map(async (trip) => {
        const latestLocation = await prisma.bus_locations.findFirst({
          where: { trip_id: trip.id },
          orderBy: { recorded_at: 'desc' },
        })

        const busLat = latestLocation ? Number(latestLocation.latitude) : 0
        const busLng = latestLocation ? Number(latestLocation.longitude) : 0
        const rawSpeed = latestLocation ? Number(latestLocation.speed ?? 0) : 0
        const movement = await getMovementProfile(prisma, trip.id)

        const shuttleId = `shuttle_${trip.buses.id}`
        const routeType = trip.route_id === 1 ? 'Main Line' : 'Express'

        // Seberapa lama bus ini tidak mengirim GPS?
        const lastSeenMs = latestLocation?.recorded_at?.getTime() ?? null
        const secondsSinceUpdate =
          lastSeenMs != null ? Math.round((Date.now() - lastSeenMs) / 1000) : null
        const isStale = lastSeenMs == null || Date.now() - lastSeenMs > STALE_THRESHOLD_MS

        const orderedStops = trip.routes.route_stops
        // Bus basi TIDAK boleh menyumbang ETA — posisinya sudah tidak dapat dipercaya.
        if (!isStale && latestLocation && orderedStops.length > 0) {
          const stopPts = orderedStops.map((rs) => ({
            stop_id: rs.stop_id,
            name: rs.stops.name,
            lat: Number(rs.stops.latitude),
            lng: Number(rs.stops.longitude),
          }))
          const waypoints = parseWaypoints(trip.routes.waypoints)

          const computed = computeEtas({
            busLat,
            busLng,
            speedKmh: movement.speedKmh,
            stops: stopPts,
            waypoints,
          })

          // Satu rute bisa melewati halte yang SAMA dua kali dalam satu putaran
          // (mis. FKG & Pangkalan MRU di Jalur B/C: sekali berangkat, sekali
          // kembali). Untuk panel kedatangan, hanya kedatangan TERDEKAT dari bus
          // ini yang relevan — tanpa dedup, bus yang sama muncul dua kali.
          const nearestPerStop = new Map<number, (typeof computed)[number]>()
          for (const c of computed) {
            const prev = nearestPerStop.get(c.stop_id)
            if (!prev || c.distanceKm < prev.distanceKm) nearestPerStop.set(c.stop_id, c)
          }

          // Penanda is_next / just_passed HARUS diturunkan dari jarak polyline yang
          // sama dengan yang dipakai menghitung ETA — kalau tidak, keduanya bisa
          // bertentangan. (Dulu ini memakai trips.next_target_stop_id dari eta-logger,
          // yang menganggap bus "tiba" saat masih 80m SEBELUM halte; akibatnya halte
          // yang sedang didekati bus salah dicap "baru dilewati" padahal ETA-nya
          // masih "arriving".)
          //
          // Pada rute melingkar: jarak maju TERKECIL = halte berikutnya; jarak maju
          // TERBESAR = halte yang baru saja ditinggalkan (harus memutar satu putaran
          // penuh untuk kembali ke sana).
          const entries = [...nearestPerStop.values()]
          let isNextStopId: number | null = null
          let justPassedStopId: number | null = null
          if (entries.length > 0) {
            let minC = entries[0]
            let maxC = entries[0]
            for (const c of entries) {
              if (c.distanceKm < minC.distanceKm) minC = c
              if (c.distanceKm > maxC.distanceKm) maxC = c
            }
            isNextStopId = minC.stop_id
            // Butuh minimal 2 halte agar "baru dilewati" bermakna dan tidak
            // menabrak halte yang sama dengan is_next.
            if (entries.length > 1 && maxC.stop_id !== minC.stop_id) {
              justPassedStopId = maxC.stop_id
            }
          }

          for (const c of nearestPerStop.values()) {
            // Status & angka menit harus lahir dari kecepatan yang SAMA dengan yang
            // dipakai menghitung ETA (movement.speedKmh), bukan dari kecepatan sesaat
            // — kalau tidak, label dan angkanya bisa saling bertentangan.
            const status: Arrival['status'] = movement.isStopped
              ? 'stopped'
              : c.etaMinutes <= 1
                ? 'arriving'
                : movement.speedKmh < 8
                  ? 'delayed'
                  : 'on-time'

            if (!arrivalsByStop.has(c.stop_id)) {
              const pt = stopPts.find((s) => s.stop_id === c.stop_id)!
              arrivalsByStop.set(c.stop_id, {
                stop_name: c.name,
                latitude: pt.lat,
                longitude: pt.lng,
                arrivals: [],
              })
            }

            arrivalsByStop.get(c.stop_id)!.arrivals.push({
              shuttle_id: shuttleId,
              bus_name: trip.buses.name,
              route_id: trip.routes.id,
              route_code: `R${trip.routes.id}`,
              route_name: trip.routes.name,
              route_type: routeType,
              // Bus berhenti → tidak ada angka menit. Haltenya tetap masuk daftar
              // (supaya tidak hilang dari panel), tapi tanpa janji waktu.
              eta_minutes: movement.isStopped ? null : c.etaMinutes,
              distance_km: Math.round(c.distanceKm * 100) / 100,
              shuttle_speed: Math.round(rawSpeed * 10) / 10,
              status,
              is_next: c.stop_id === isNextStopId,
              just_passed: c.stop_id === justPassedStopId,
              stopped_seconds: movement.stoppedSeconds,
            })
          }
        }

        return {
          id: shuttleId,
          trip_id: trip.id,
          bus_name: trip.buses.name,
          license_plate: trip.buses.license_plate,
          route_id: trip.routes.id,
          route_name: trip.routes.name,
          route_code: `R${trip.routes.id}`,
          latitude: busLat,
          longitude: busLng,
          speed_kmh: rawSpeed,
          heading: 0,
          timestamp: lastSeenMs ?? Date.now(),
          status: trip.status as 'active' | 'inactive',
          is_stale: isStale,
          seconds_since_update: secondsSinceUpdate,
          is_stopped: !isStale && movement.isStopped,
          stopped_seconds: movement.stoppedSeconds,
        }
      })
    )

    // 3. Ratakan map → array stopEtas, tiap stop diurut arrival-nya, lalu stop
    //    diurut berdasar kedatangan tercepatnya (mendekati makna "Nearby").
    //    Bus berhenti (eta_minutes null) diperlakukan sebagai tak-hingga, jadi
    //    selalu jatuh ke urutan paling belakang — bukan ke depan.
    const sortKey = (a: Arrival) => a.eta_minutes ?? Infinity
    const stopEtas = Array.from(arrivalsByStop.entries()).map(([stop_id, s]) => {
      const arrivals = [...s.arrivals].sort((a, b) => sortKey(a) - sortKey(b))
      return {
        stop_id,
        stop_name: s.stop_name,
        latitude: s.latitude,
        longitude: s.longitude,
        arrivals,
      }
    })
    stopEtas.sort((a, b) => sortKey(a.arrivals[0]) - sortKey(b.arrivals[0]))

    // 4. Semua halte (untuk overlay peta).
    const stops = await prisma.stops.findMany()

    return NextResponse.json({
      shuttles,
      stopEtas,
      stops: stops.map((s) => ({
        id: s.id,
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      })),
      lastUpdate: Date.now(),
    })
  } catch (error) {
    console.error('Live API error:', error)
    return NextResponse.json(
      { shuttles: [], stopEtas: [], stops: [], error: String(error) },
      { status: 500 }
    )
  }
}
