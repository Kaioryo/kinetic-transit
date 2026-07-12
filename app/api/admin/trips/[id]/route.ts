import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

// PATCH /api/admin/trips/[id] — akhiri perjalanan (status → completed)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const tripId = parseInt(id, 10)

  const trip = await prisma.trips.findUnique({ where: { id: tripId } })
  if (!trip) {
    return NextResponse.json({ error: 'Perjalanan tidak ditemukan.' }, { status: 404 })
  }
  if (trip.status !== 'active') {
    return NextResponse.json({ error: 'Perjalanan ini sudah tidak aktif.' }, { status: 409 })
  }

  const updated = await prisma.trips.update({
    where: { id: tripId },
    data: {
      status: 'completed',
      ended_at: new Date(),
      // Target halte tidak lagi bermakna setelah perjalanan berakhir.
      next_target_stop_id: null,
    },
  })

  // Bersihkan prediksi ETA yang menggantung: perjalanan sudah berakhir, jadi
  // bus tidak akan pernah "tiba" di halte target — baris ini tidak akan pernah
  // terisi actual_arrival dan hanya jadi sampah di data evaluasi.
  const { count } = await prisma.eta_logs.deleteMany({
    where: { trip_id: tripId, actual_arrival: null },
  })

  return NextResponse.json({ ...updated, discarded_pending_predictions: count })
}
