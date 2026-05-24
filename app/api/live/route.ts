import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/live — Query active trips with latest bus locations and ETAs

// Types for Prisma query results
type TripWithRelations = Prisma.tripsGetPayload<{
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
    etas: {
      include: { stops: true }
    }
  }
}>

type ETAWithStop = Prisma.etasGetPayload<{
  include: { stops: true }
}>

export async function GET() {
  try {
    // 1. Get all active trips with related data
    const activeTrips: TripWithRelations[] = await prisma.trips.findMany({
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
        etas: {
          include: { stops: true },
        },
      },
    })

    // 2. Get latest bus_location for each active trip
    const shuttles = await Promise.all(
      activeTrips.map(async (trip: TripWithRelations) => {
        const latestLocation = await prisma.bus_locations.findFirst({
          where: { trip_id: trip.id },
          orderBy: { recorded_at: 'desc' },
        })

        return {
          id: `shuttle_${trip.buses.id}`,
          trip_id: trip.id,
          bus_name: trip.buses.name,
          license_plate: trip.buses.license_plate,
          route_id: trip.routes.id,
          route_name: trip.routes.name,
          route_code: `R${trip.routes.id}`,
          latitude: latestLocation ? Number(latestLocation.latitude) : 0,
          longitude: latestLocation ? Number(latestLocation.longitude) : 0,
          speed_kmh: latestLocation ? Number(latestLocation.speed || 0) : 0,
          heading: 0,
          timestamp: latestLocation?.recorded_at?.getTime() || Date.now(),
          status: trip.status as 'active' | 'inactive',
        }
      })
    )

    // 3. Build ETA list from etas table
    const etas = activeTrips.flatMap((trip: TripWithRelations) =>
      trip.etas.map((eta: ETAWithStop) => {
        const now = new Date()
        const arrivalTime = new Date(eta.estimated_arrival)
        const diffMs = arrivalTime.getTime() - now.getTime()
        const etaMinutes = Math.max(1, Math.round(diffMs / 60000))

        return {
          shuttle_id: `shuttle_${trip.buses.id}`,
          route_id: trip.routes.id,
          route_code: `R${trip.routes.id}`,
          route_name: trip.routes.name,
          route_type: trip.route_id === 1 ? 'Main Line' : 'Express',
          stop_id: eta.stop_id,
          stop_name: eta.stops.name,
          eta_minutes: etaMinutes,
          distance_km: 0,
          shuttle_speed: 0,
          status: etaMinutes <= 1 ? 'arriving' as const : etaMinutes > 15 ? 'delayed' as const : 'on-time' as const,
        }
      })
    )

    // Sort ETAs by time ascending
    etas.sort((a: { eta_minutes: number }, b: { eta_minutes: number }) => a.eta_minutes - b.eta_minutes)

    // 4. Get all stops
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
