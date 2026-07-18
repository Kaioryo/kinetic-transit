import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/history — daftar perjalanan yang PUNYA rekaman GPS (untuk playback).
// Hanya trip dengan cukup titik yang ditampilkan (menyaring trip kosong/mis-start).
const MIN_POINTS = 10

export async function GET() {
  try {
    const trips = await prisma.trips.findMany({
      include: {
        routes: { select: { name: true } },
        buses: { select: { name: true } },
        _count: { select: { bus_locations: true } },
      },
      orderBy: { started_at: 'desc' },
    })

    const items = trips
      .filter((t) => t._count.bus_locations >= MIN_POINTS)
      .map((t) => ({
        id: t.id,
        route_name: t.routes.name,
        bus_name: t.buses.name,
        started_at: t.started_at,
        ended_at: t.ended_at,
        point_count: t._count.bus_locations,
        duration_ms:
          t.started_at && t.ended_at
            ? new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()
            : null,
      }))

    return NextResponse.json({ trips: items })
  } catch (error) {
    console.error('History list error:', error)
    return NextResponse.json({ trips: [], error: String(error) }, { status: 500 })
  }
}
