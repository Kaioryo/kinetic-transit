import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Manajemen Perjalanan (trip) — INI YANG MENENTUKAN bus muncul di peta/ETA.
// `trips.status = 'active'` adalah patokan /api/live: tanpa trip aktif, GPS dari
// ESP32 tetap masuk ke bus_locations tapi bus TIDAK ditampilkan ke penumpang.

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

// GET /api/admin/trips — daftar trip (aktif dulu, lalu riwayat terbaru)
export async function GET() {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const trips = await prisma.trips.findMany({
    include: { buses: true, routes: true },
    orderBy: [{ status: 'asc' }, { id: 'desc' }],
    take: 50,
  })

  return NextResponse.json(
    trips.map((t) => ({
      id: t.id,
      bus_id: t.bus_id,
      bus_name: t.buses.name,
      license_plate: t.buses.license_plate,
      route_id: t.route_id,
      route_name: t.routes.name,
      status: t.status,
      started_at: t.started_at,
      ended_at: t.ended_at,
    }))
  )
}

// POST /api/admin/trips — mulai perjalanan baru (bus + jalur → trip aktif)
export async function POST(req: Request) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bus_id, route_id } = await req.json()

  const busId = parseInt(String(bus_id), 10)
  const routeId = parseInt(String(route_id), 10)

  if (!busId || !routeId) {
    return NextResponse.json({ error: 'bus_id dan route_id wajib diisi.' }, { status: 400 })
  }

  const [bus, route] = await Promise.all([
    prisma.buses.findUnique({ where: { id: busId } }),
    prisma.routes.findUnique({ where: { id: routeId } }),
  ])

  if (!bus) return NextResponse.json({ error: 'Bus tidak ditemukan.' }, { status: 404 })
  if (!route) return NextResponse.json({ error: 'Jalur tidak ditemukan.' }, { status: 404 })

  // Satu bus tidak boleh punya dua perjalanan aktif sekaligus — GPS-nya cuma
  // satu, jadi tidak jelas trip mana yang harus menerima lokasinya.
  const existing = await prisma.trips.findFirst({
    where: { bus_id: busId, status: 'active' },
    include: { routes: true },
  })

  if (existing) {
    return NextResponse.json(
      {
        error: `Bus "${bus.name}" sudah punya perjalanan aktif di ${existing.routes.name}. Akhiri dulu perjalanan itu.`,
      },
      { status: 409 }
    )
  }

  const trip = await prisma.trips.create({
    data: {
      bus_id: busId,
      route_id: routeId,
      status: 'active',
      started_at: new Date(),
    },
  })

  return NextResponse.json(trip, { status: 201 })
}
