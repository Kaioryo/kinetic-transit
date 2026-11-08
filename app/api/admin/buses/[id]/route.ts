import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { hasAdminSession } from '@/lib/admin-session'
import { prisma } from '@/lib/prisma'
import { handleBusWriteError } from '@/lib/bus-write-error'

// PUT /api/admin/buses/[id] — edit bus
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { name, license_plate, status } = await req.json()

  try {
    const bus = await prisma.buses.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(license_plate && { license_plate }),
        ...(status && { status }),
      },
    })
    return NextResponse.json(bus)
  } catch (error) {
    return handleBusWriteError(error)
  }
}

// DELETE /api/admin/buses/[id] — hapus bus
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const busId = parseInt(id)

  const conflict = () => NextResponse.json({
    error: 'Armada masih dirujuk riwayat ETA dan tidak dapat dihapus.',
  }, { status: 409 })

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const history = await tx.eta_logs.findFirst({
        where: { trip: { bus_id: busId } },
        select: { id: true },
      })
      if (history) return false

      await tx.trips.updateMany({
        where: { bus_id: busId, status: 'active' },
        data: { status: 'completed', ended_at: new Date() },
      })
      await tx.buses.delete({ where: { id: busId } })
      return true
    })
    return deleted ? NextResponse.json({ success: true }) : conflict()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')) {
      return conflict()
    }
    throw error
  }
}
