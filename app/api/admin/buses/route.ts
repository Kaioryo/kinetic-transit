import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

// GET /api/admin/buses
export async function GET() {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const buses = await prisma.buses.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json(buses)
}

// POST /api/admin/buses — tambah bus baru
export async function POST(req: Request) {
  const cookieStore = await cookies()
  if (!isAuthenticated(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, license_plate, status } = await req.json()

  if (!name || !license_plate) {
    return NextResponse.json({ error: 'name dan license_plate wajib diisi.' }, { status: 400 })
  }

  const bus = await prisma.buses.create({
    data: { name, license_plate, status: status || 'active' },
  })

  return NextResponse.json(bus, { status: 201 })
}
