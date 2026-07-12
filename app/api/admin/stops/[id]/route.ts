import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

// PUT /api/admin/stops/[id] — edit stop
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { name, latitude, longitude } = await req.json()

  const stop = await prisma.stops.update({
    where: { id: parseInt(id) },
    data: {
      ...(name && { name }),
      ...(latitude != null && { latitude: parseFloat(latitude) }),
      ...(longitude != null && { longitude: parseFloat(longitude) }),
    },
  })

  return NextResponse.json(stop)
}

// DELETE /api/admin/stops/[id] — hapus stop
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const stopId = parseInt(id)

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Ambil data route_stops yang dimiliki halte ini sebelum dihapus
      const routeStops = await tx.route_stops.findMany({
        where: { stop_id: stopId }
      })

      // 2. Cascade: hapus route_stops & log ETA dulu, lalu stop-nya
      await tx.route_stops.deleteMany({ where: { stop_id: stopId } })
      await tx.eta_logs.deleteMany({ where: { stop_id: stopId } })
      await tx.stops.delete({ where: { id: stopId } })

      // 3. Tutup jarak (gap) urutan untuk setiap jalur yang terdampak
      for (const rs of routeStops) {
        const affectedStops = await tx.route_stops.findMany({
          where: {
            route_id: rs.route_id,
            stop_order: { gt: rs.stop_order }
          },
          orderBy: { stop_order: 'asc' } // Ascending agar pergeseran -1 aman
        })

        // Geser mereka semua -1
        for (const affected of affectedStops) {
          await tx.route_stops.update({
            where: { id: affected.id },
            data: { stop_order: affected.stop_order - 1 }
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error delete stop:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
