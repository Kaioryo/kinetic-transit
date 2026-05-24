import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/simulate — Advance GPS simulation by one tick
// Moves all active buses along their routes and recalculates ETAs
// This replaces the in-memory mock simulator with MySQL-backed simulation

// Waypoints for each route (matching the route stops)
const ROUTE_WAYPOINTS: Record<number, { lat: number; lng: number }[]> = {
  1: [ // Rektorat -> GKU
    { lat: -6.92713500, lng: 107.77120000 },
    { lat: -6.92690000, lng: 107.77180000 },
    { lat: -6.92670000, lng: 107.77250000 },
    { lat: -6.92650000, lng: 107.77350000 },
    { lat: -6.92620000, lng: 107.77420000 },
    { lat: -6.92580000, lng: 107.77500000 },
    { lat: -6.92550000, lng: 107.77600000 },
    { lat: -6.92500000, lng: 107.77680000 },
    { lat: -6.92450000, lng: 107.77750000 },
    { lat: -6.92400000, lng: 107.77850000 },
    { lat: -6.92350000, lng: 107.77920000 },
    { lat: -6.92300000, lng: 107.78000000 },
    { lat: -6.92250000, lng: 107.78100000 },
  ],
  2: [ // Rektorat -> FISIP
    { lat: -6.92713500, lng: 107.77120000 },
    { lat: -6.92680000, lng: 107.77200000 },
    { lat: -6.92650000, lng: 107.77350000 },
    { lat: -6.92700000, lng: 107.77380000 },
    { lat: -6.92750000, lng: 107.77420000 },
    { lat: -6.92800000, lng: 107.77450000 },
    { lat: -6.92750000, lng: 107.77550000 },
    { lat: -6.92600000, lng: 107.77700000 },
    { lat: -6.92400000, lng: 107.77850000 },
    { lat: -6.92550000, lng: 107.77750000 },
    { lat: -6.92700000, lng: 107.77680000 },
    { lat: -6.92850000, lng: 107.77700000 },
    { lat: -6.92900000, lng: 107.77700000 },
  ],
}

// Simple state tracking per trip (in-memory, resets on server restart)
const tripState: Record<number, { wpIndex: number; progress: number; direction: 1 | -1 }> = {}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST() {
  try {
    const activeTrips = await prisma.trips.findMany({
      where: { status: 'active' },
      include: {
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

    const results = []

    for (const trip of activeTrips) {
      const waypoints = ROUTE_WAYPOINTS[trip.route_id]
      if (!waypoints || waypoints.length < 2) continue

      // Initialize state if needed
      if (!tripState[trip.id]) {
        tripState[trip.id] = {
          wpIndex: Math.floor(Math.random() * (waypoints.length - 2)),
          progress: 0,
          direction: 1,
        }
      }

      const state = tripState[trip.id]
      const speed = 15 + Math.random() * 15 // 15-30 km/h
      const distPerTick = speed * 0.000833 // ~3 sec of movement

      // Move along waypoints
      const nextIdx = state.wpIndex + state.direction
      if (nextIdx < 0 || nextIdx >= waypoints.length) {
        state.direction = (state.direction * -1) as 1 | -1
      }

      const safeNext = Math.max(0, Math.min(waypoints.length - 1, state.wpIndex + state.direction))
      const current = waypoints[state.wpIndex]
      const next = waypoints[safeNext]
      const segDist = haversineDistance(current.lat, current.lng, next.lat, next.lng)

      if (segDist > 0) {
        state.progress += distPerTick / segDist
      } else {
        state.progress = 1
      }

      if (state.progress >= 1) {
        state.wpIndex = safeNext
        state.progress = 0
        const checkNext = state.wpIndex + state.direction
        if (checkNext < 0 || checkNext >= waypoints.length) {
          state.direction = (state.direction * -1) as 1 | -1
        }
      }

      // Interpolate position
      const interpNext = Math.max(0, Math.min(waypoints.length - 1, state.wpIndex + state.direction))
      const t = Math.min(state.progress, 1)
      const lat = waypoints[state.wpIndex].lat + (waypoints[interpNext].lat - waypoints[state.wpIndex].lat) * t
      const lng = waypoints[state.wpIndex].lng + (waypoints[interpNext].lng - waypoints[state.wpIndex].lng) * t

      // INSERT into bus_locations
      await prisma.bus_locations.create({
        data: {
          trip_id: trip.id,
          latitude: lat,
          longitude: lng,
          speed: Math.round(speed * 100) / 100,
          recorded_at: new Date(),
        },
      })

      // Calculate & UPSERT ETAs for each stop on this route
      const routeStops = trip.routes.route_stops
      for (const rs of routeStops) {
        const stopLat = Number(rs.stops.latitude)
        const stopLng = Number(rs.stops.longitude)
        const dist = haversineDistance(lat, lng, stopLat, stopLng) * 1.3 // road factor
        const etaMinutes = Math.max(1, Math.round((dist / Math.max(speed, 5)) * 60))
        const estimatedArrival = new Date(Date.now() + etaMinutes * 60000)

        await prisma.etas.upsert({
          where: {
            trip_id_stop_id: {
              trip_id: trip.id,
              stop_id: rs.stop_id,
            },
          },
          update: {
            estimated_arrival: estimatedArrival,
            calculated_at: new Date(),
          },
          create: {
            trip_id: trip.id,
            stop_id: rs.stop_id,
            estimated_arrival: estimatedArrival,
            calculated_at: new Date(),
          },
        })
      }

      results.push({
        trip_id: trip.id,
        lat: Math.round(lat * 100000000) / 100000000,
        lng: Math.round(lng * 100000000) / 100000000,
        speed: Math.round(speed * 10) / 10,
      })
    }

    return NextResponse.json({ success: true, updated: results })
  } catch (error) {
    console.error('Simulate error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
