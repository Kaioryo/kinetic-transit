import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

// GET /api/admin/history/[id] — jejak GPS lengkap satu perjalanan untuk playback.
// Admin-only. Mengembalikan trace (urut waktu, offset ms dari awal) + halte rute.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const tripId = parseInt(id, 10)
    if (!Number.isFinite(tripId)) {
      return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })
    }

    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      include: {
        routes: {
          include: {
            route_stops: { include: { stops: true }, orderBy: { stop_order: 'asc' } },
          },
        },
        buses: { select: { name: true } },
      },
    })
    if (!trip) {
      return NextResponse.json({ error: 'trip tidak ditemukan' }, { status: 404 })
    }

    const locs = await prisma.bus_locations.findMany({
      where: { trip_id: tripId },
      orderBy: { recorded_at: 'asc' },
      select: { latitude: true, longitude: true, speed: true, recorded_at: true },
    })

    const t0 = locs[0]?.recorded_at?.getTime() ?? 0
    const trace = locs.map((l) => ({
      lat: Number(l.latitude),
      lng: Number(l.longitude),
      t: (l.recorded_at?.getTime() ?? t0) - t0,
      speed: Number(l.speed ?? 0),
    }))

    // Dedup halte (rute B/C melewati halte sama 2x) — cukup satu titik per halte.
    const seen = new Set<number>()
    const stops = trip.routes.route_stops
      .filter((rs) => (seen.has(rs.stop_id) ? false : (seen.add(rs.stop_id), true)))
      .map((rs) => ({
        name: rs.stops.name,
        lat: Number(rs.stops.latitude),
        lng: Number(rs.stops.longitude),
      }))

    return NextResponse.json({
      trip: {
        id: trip.id,
        route_name: trip.routes.name,
        bus_name: trip.buses.name,
        started_at: trip.started_at,
        ended_at: trip.ended_at,
        duration_ms: trace.length ? trace[trace.length - 1].t : 0,
      },
      stops,
      trace,
    })
  } catch (error) {
    console.error('History trace error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
