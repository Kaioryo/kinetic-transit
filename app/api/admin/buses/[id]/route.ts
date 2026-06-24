import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

// PUT /api/admin/buses/[id] — edit bus
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { name, license_plate, status } = await req.json()

  const bus = await prisma.buses.update({
    where: { id: parseInt(id) },
    data: {
      ...(name && { name }),
      ...(license_plate && { license_plate }),
      ...(status && { status }),
    },
  })

  return NextResponse.json(bus)
}

// DELETE /api/admin/buses/[id] — hapus bus
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const busId = parseInt(id)

  // Selesaikan trip aktif dulu sebelum hapus bus
  await prisma.trips.updateMany({
    where: { bus_id: busId, status: 'active' },
    data: { status: 'completed', ended_at: new Date() },
  })

  await prisma.buses.delete({ where: { id: busId } })

  return NextResponse.json({ success: true })
}
