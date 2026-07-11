import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { computeEtas, parseWaypoints } from '@/lib/eta-engine.mjs'

// GET /api/live — Query active trips + latest location, and compute ETAs on-read.
//
// ETA dihitung langsung saat request (bukan disimpan ke tabel `etas`), sehingga
// selalu segar. Perhitungan jarak/ETA memakai lib/eta-engine.mjs (sumber tunggal,
// dipakai juga oleh eta-logger untuk evaluasi akurasi):
//   - SEPANJANG POLYLINE JALAN ASLI (routes.waypoints dari OSRM) bila tersedia,
//   - atau FALLBACK ke jarak garis-lurus antar halte (× road factor) bila belum.
// Untuk rute melingkar, halte yang baru dilewati otomatis "jauh" satu putaran.

const DEFAULT_SPEED_KMH = 15

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

    const etas: Array<{
      shuttle_id: string
      route_id: number
      route_code: string
      route_name: string
      route_type: string
      stop_id: number
      stop_name: string
      eta_minutes: number
      distance_km: number
      shuttle_speed: number
      status: 'on-time' | 'delayed' | 'arriving'
    }> = []

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
        const speedForEta = rawSpeed > 0 ? rawSpeed : DEFAULT_SPEED_KMH

        const shuttleId = `shuttle_${trip.buses.id}`
        const routeType = trip.route_id === 1 ? 'Main Line' : 'Express'

        const orderedStops = trip.routes.route_stops
        if (latestLocation && orderedStops.length > 0) {
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
            speedKmh: speedForEta,
            stops: stopPts,
            waypoints,
          })

          for (const c of computed) {
            const status: 'on-time' | 'delayed' | 'arriving' =
              c.etaMinutes <= 1 ? 'arriving' : rawSpeed > 0 && rawSpeed < 8 ? 'delayed' : 'on-time'

            etas.push({
              shuttle_id: shuttleId,
              route_id: trip.routes.id,
              route_code: `R${trip.routes.id}`,
              route_name: trip.routes.name,
              route_type: routeType,
              stop_id: c.stop_id,
              stop_name: c.name,
              eta_minutes: c.etaMinutes,
              distance_km: Math.round(c.distanceKm * 100) / 100,
              shuttle_speed: Math.round(rawSpeed * 10) / 10,
              status,
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
          timestamp: latestLocation?.recorded_at?.getTime() || Date.now(),
          status: trip.status as 'active' | 'inactive',
        }
      })
    )

    // Urutkan ETA dari yang paling dekat.
    etas.sort((a, b) => a.eta_minutes - b.eta_minutes)

    // 3. Semua halte (untuk overlay peta).
    const stops = await prisma.stops.findMany()

    return NextResponse.json({
      shuttles,
      etas,
      stops: stops.map((s) => ({
        id: `stop_${s.id}`,
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      })),
      lastUpdate: Date.now(),
    })
  } catch (error) {
    console.error('Live API error:', error)
    return NextResponse.json(
      { shuttles: [], etas: [], stops: [], error: String(error) },
      { status: 500 }
    )
  }
}
