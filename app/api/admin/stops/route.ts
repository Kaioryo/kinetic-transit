import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

// GET /api/admin/stops — list semua stops
export async function GET() {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stops = await prisma.stops.findMany({
    include: { route_stops: { include: { routes: true }, orderBy: { stop_order: 'asc' } } },
  })

  // Sort stops secara logis: 
  // 1. Prioritaskan berdasarkan rute terkecil yang dimiliki (A -> B -> C)
  // 2. Jika rute sama, urutkan berdasarkan stop_order terkecil
  // 3. Jika tidak punya rute, taruh di paling bawah
  stops.sort((a, b) => {
    const aRoute = a.route_stops[0]
    const bRoute = b.route_stops[0]

    if (!aRoute && !bRoute) return a.id - b.id
    if (!aRoute) return 1
    if (!bRoute) return -1

    if (aRoute.route_id !== bRoute.route_id) {
      return aRoute.route_id - bRoute.route_id
    }
    return aRoute.stop_order - bRoute.stop_order
  })

  return NextResponse.json(stops)
}

// POST /api/admin/stops — tambah stop baru
export async function POST(req: Request) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, latitude, longitude, route_id, stop_order } = await req.json()

  if (!name || latitude == null || longitude == null) {
    return NextResponse.json({ error: 'name, latitude, longitude wajib diisi.' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat haltenya dulu
      const stop = await tx.stops.create({
        data: { name, latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      })

      // 2. Jika di-assign ke jalur, kita atur urutannya
      if (route_id && stop_order) {
        const rId = parseInt(route_id)
        const sOrder = parseInt(stop_order)

        // Cari semua halte di jalur ini yang urutannya >= sOrder
        const affectedStops = await tx.route_stops.findMany({
          where: { route_id: rId, stop_order: { gte: sOrder } },
          orderBy: { stop_order: 'desc' }, // Descending agar shift +1 tidak nabrak unique constraint
        })

        // Geser mereka semua +1
        for (const rs of affectedStops) {
          await tx.route_stops.update({
            where: { id: rs.id },
            data: { stop_order: rs.stop_order + 1 },
          })
        }

        // 3. Masukkan halte baru di urutan tersebut
        await tx.route_stops.create({
          data: { route_id: rId, stop_id: stop.id, stop_order: sOrder },
        })
      }

      return stop
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error add stop:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
