import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/seed — Seed initial data into MySQL
// Run once to populate buses, routes, stops, route_stops, and trips

export async function POST() {
  try {
    // 1. Seed Buses
    const busesData = [
      { name: 'Odong-odong A', license_plate: 'D 1234 AB', status: 'active' },
    ]

    for (const bus of busesData) {
      await prisma.buses.upsert({
        where: { license_plate: bus.license_plate },
        update: { name: bus.name, status: bus.status },
        create: bus,
      })
    }

    // 2. Seed Routes (rute odong-odong dari data gathering lapangan)
    const routesData = [
      { id: 1, name: 'Rute Odong-odong Jatinangor', description: 'Rute utama odong-odong di area kampus Jatinangor' },
    ]

    for (const route of routesData) {
      await prisma.routes.upsert({
        where: { id: route.id },
        update: { name: route.name, description: route.description },
        create: route,
      })
    }

    // 3. Seed Stops (koordinat titik pemberhentian riil dari data gathering lapangan)
    const stopsData = [
      { id: 1,  name: 'Pangkalan Odong MRU',                  latitude: -6.931126, longitude: 107.774791 },
      { id: 2,  name: 'FKG',                                   latitude: -6.929892, longitude: 107.775532 },
      { id: 3,  name: 'Halte depan FK A02',                    latitude: -6.929557, longitude: 107.773847 },
      { id: 4,  name: 'Halte depan FAPSI A03',                 latitude: -6.928311, longitude: 107.773631 },
      { id: 5,  name: 'Halte depan FMIPA luar A04',            latitude: -6.927571, longitude: 107.772909 },
      { id: 6,  name: 'Halte depan Biologi A05',               latitude: -6.927146, longitude: 107.772298 },
      { id: 7,  name: 'Halte FAPERTA Saintek luar A06',        latitude: -6.925319, longitude: 107.771151 },
      { id: 8,  name: 'Halte FAPET A07',                       latitude: -6.924228, longitude: 107.771095 },
      { id: 9,  name: 'Halte FPIK A08',                        latitude: -6.923157, longitude: 107.770258 },
      { id: 10, name: 'FPIK C07',                              latitude: -6.922374, longitude: 107.770273 },
      { id: 11, name: 'Halte depan Balwil 1 A09',              latitude: -6.921914, longitude: 107.770112 },
      { id: 12, name: 'Rektorat C06',                          latitude: -6.921659, longitude: 107.771112 },
      { id: 13, name: 'Halte Rektorat C08',                    latitude: -6.921017, longitude: 107.771536 },
      { id: 14, name: 'Farmasi A10',                           latitude: -6.921447, longitude: 107.771691 },
      { id: 15, name: 'Bunderan Alfa X C05',                   latitude: -6.922331, longitude: 107.772582 },
      { id: 16, name: 'Alfa X B09',                            latitude: -6.922353, longitude: 107.772967 },
      { id: 17, name: 'FTG C04',                               latitude: -6.922830, longitude: 107.772850 },
      { id: 18, name: 'Elektro A11',                           latitude: -6.923820, longitude: 107.772987 },
      { id: 19, name: 'FAPET A12',                             latitude: -6.924417, longitude: 107.773277 },
      { id: 20, name: 'Statis C03',                            latitude: -6.924713, longitude: 107.773312 },
      { id: 21, name: 'Kimia C02',                             latitude: -6.926222, longitude: 107.774071 },
      { id: 22, name: 'LAB Sentral A14',                       latitude: -6.926453, longitude: 107.774252 },
      { id: 23, name: 'FAPSI A15',                             latitude: -6.927475, longitude: 107.774727 },
      { id: 24, name: 'FKEP C01',                              latitude: -6.928108, longitude: 107.774936 },
      { id: 25, name: 'Kandaga A16',                           latitude: -6.928343, longitude: 107.775137 },
      { id: 26, name: 'Kandaga samping B14',                   latitude: -6.928045, longitude: 107.775954 },
      { id: 27, name: 'FH B13',                                latitude: -6.927071, longitude: 107.775544 },
      { id: 28, name: 'FIKOM B12',                             latitude: -6.925495, longitude: 107.774834 },
      { id: 29, name: 'FEB B11',                               latitude: -6.923679, longitude: 107.774036 },
      { id: 30, name: 'Samping Alfa X B10',                    latitude: -6.922720, longitude: 107.773313 },
      { id: 31, name: 'Alfa X kanan B08',                      latitude: -6.922087, longitude: 107.773454 },
      { id: 32, name: 'FEB B07',                               latitude: -6.923366, longitude: 107.774658 },
      { id: 33, name: 'FIKOM B06',                             latitude: -6.924764, longitude: 107.775716 },
      { id: 34, name: 'FIKOM Gerbang masuk SOSHUM B05',        latitude: -6.925533, longitude: 107.776813 },
      { id: 35, name: 'FIB B04',                               latitude: -6.926916, longitude: 107.777524 },
      { id: 36, name: 'FIB Bawah Gerbang B03',                 latitude: -6.927891, longitude: 107.777680 },
      { id: 37, name: 'Halte FISIP B02',                       latitude: -6.928777, longitude: 107.777395 },
    ]

    for (const stop of stopsData) {
      await prisma.stops.upsert({
        where: { id: stop.id },
        update: { name: stop.name, latitude: stop.latitude, longitude: stop.longitude },
        create: stop,
      })
    }

    // 4. Seed Route Stops (urutan 37 halte di rute odong-odong)
    const routeStopsData = Array.from({ length: 37 }, (_, i) => ({
      route_id: 1,
      stop_id: i + 1,
      stop_order: i + 1,
    }))

    // Clear existing route_stops first
    await prisma.route_stops.deleteMany({})
    for (const rs of routeStopsData) {
      await prisma.route_stops.create({ data: rs })
    }

    // 5. Seed Trip (1 bus aktif = Odong-odong A yang dipasangi ESP32)
    const buses = await prisma.buses.findMany()
    const tripsData = [
      { bus_id: buses[0]?.id || 1, route_id: 1, status: 'active', started_at: new Date() },
    ]

    // Clear old active trips
    await prisma.trips.updateMany({
      where: { status: 'active' },
      data: { status: 'completed', ended_at: new Date() },
    })

    for (const trip of tripsData) {
      await prisma.trips.create({ data: trip })
    }

    // 6. Seed initial bus_location (posisi awal = Pangkalan Odong MRU)
    const newTrips = await prisma.trips.findMany({ where: { status: 'active' } })

    for (let i = 0; i < newTrips.length; i++) {
      await prisma.bus_locations.create({
        data: {
          trip_id: newTrips[i].id,
          latitude: -6.931126,  // Pangkalan Odong MRU (titik awal rute)
          longitude: 107.774791,
          speed: 0,
          recorded_at: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        buses: buses.length,
        routes: routesData.length,
        stops: stopsData.length,
        route_stops: routeStopsData.length,
        trips: newTrips.length,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
