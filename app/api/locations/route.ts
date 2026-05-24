import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/locations
// Endpoint untuk menerima data koordinat GPS dari perangkat IoT (ESP32)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Validasi input minimal: butuh license_plate, latitude, dan longitude
    const { license_plate, latitude, longitude, speed } = body

    if (!license_plate || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required payload: license_plate, latitude, longitude' },
        { status: 400 }
      )
    }

    // 1. Cari Bus ID berdasarkan Plat Nomor
    const bus = await prisma.buses.findUnique({
      where: { license_plate }
    })

    if (!bus) {
      return NextResponse.json(
        { success: false, error: `Bus with license plate ${license_plate} not found` },
        { status: 404 }
      )
    }

    // 2. Cari Trip (Perjalanan) yang sedang aktif untuk Bus ini
    const activeTrip = await prisma.trips.findFirst({
      where: {
        bus_id: bus.id,
        status: 'active' // Mengasumsikan status perjalanan yang sedang berjalan adalah 'active'
      }
    })

    if (!activeTrip) {
      // Jika bus online tapi tidak memiliki trip, kita bisa memilih untuk membuat log saja 
      // Atau menolak input. Untuk saat ini kita return error.
      return NextResponse.json(
        { success: false, error: 'No active trip found for this bus' },
        { status: 404 }
      )
    }

    // 3. Simpan koordinat baru ke database
    const newLocation = await prisma.bus_locations.create({
      data: {
        trip_id: activeTrip.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed ? parseFloat(speed) : null
      }
    })

    // (Opsional) Di sini Anda juga bisa memanggil helper re-kalkulasi ETA secara otomatis
    // jika ingin ETA dihitung real-time langsung di setiap ping dari ESP32.

    return NextResponse.json({
      success: true,
      message: 'Location updated via IoT successfully',
      location: newLocation
    })

  } catch (error: any) {
    console.error('Error handling IoT POST:', error.message)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
