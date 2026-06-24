import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/seed — Seed initial data into MySQL
// Run once to populate buses, routes, stops, route_stops, and trips

export async function POST() {
  try {
    // ─── 1. Seed Buses ─────────────────────────────────────────────────────────
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

    // ─── 2. Seed Routes ────────────────────────────────────────────────────────
    // Jalur A (IPA/Saintek) — Sisi Barat kampus, melewati FK, FMIPA, FPIK, Rektorat
    // Jalur B (IPS/Soshum) — Sisi Timur kampus, melewati FISIP, FIB, FIKOM, FEB
    // Jalur C (Tengah)     — Jalur tengah kampus, melewati Kimia, Statistika, FTG
    const routesData = [
      { id: 1, name: 'Jalur A (IPA/Saintek)', description: 'Rute sisi barat kampus: MRU → A02–A16 (Saintek) → FKG → MRU' },
      { id: 2, name: 'Jalur B (IPS/Soshum)',  description: 'Rute sisi timur kampus: MRU → FKG → B02–B14 (Soshum) → FKG → MRU' },
      { id: 3, name: 'Jalur C (Tengah)',       description: 'Rute tengah kampus: MRU → FKG → C01–C08 → B09–B14 → FKG → MRU' },
    ]

    for (const route of routesData) {
      await prisma.routes.upsert({
        where: { id: route.id },
        update: { name: route.name, description: route.description },
        create: route,
      })
    }

    // ─── 3. Seed Stops ─────────────────────────────────────────────────────────
    // ID  1    = Pangkalan Odong MRU (titik awal semua jalur)
    // ID  2    = FKG                 (halte bersama / transit)
    // ID  3–20 = Halte kode A (A02–A16, termasuk A13 Lapmer)
    // ID 21–27 = Halte kode C (C01–C08)
    // ID 28–38 = Halte kode B (B02–B14, urutan sesuai perjalanan keluar)
    const stopsData = [
      // ── Titik awal & transit bersama ──
      { id: 1,  name: 'Pangkalan Odong MRU',             latitude: -6.931126, longitude: 107.774791 },
      { id: 2,  name: 'FKG',                              latitude: -6.929892, longitude: 107.775532 },

      // ── Jalur A (kode A02–A16) ────────────────────────────────────────────
      { id: 3,  name: 'Halte depan FK (A02)',             latitude: -6.929557, longitude: 107.773847 },
      { id: 4,  name: 'Halte depan FAPSI (A03)',          latitude: -6.928311, longitude: 107.773631 },
      { id: 5,  name: 'Halte depan FMIPA luar (A04)',     latitude: -6.927571, longitude: 107.772909 },
      { id: 6,  name: 'Halte depan Biologi (A05)',        latitude: -6.927146, longitude: 107.772298 },
      { id: 7,  name: 'Halte FAPERTA Saintek (A06)',      latitude: -6.925319, longitude: 107.771151 },
      { id: 8,  name: 'Halte FAPET (A07)',                latitude: -6.924228, longitude: 107.771095 },
      { id: 9,  name: 'Halte FPIK (A08)',                 latitude: -6.923157, longitude: 107.770258 },
      { id: 10, name: 'Halte depan Balwil 1 (A09)',       latitude: -6.921914, longitude: 107.770112 },
      { id: 11, name: 'Farmasi (A10)',                    latitude: -6.921447, longitude: 107.771691 },
      { id: 12, name: 'Elektro (A11)',                    latitude: -6.923820, longitude: 107.772987 },
      { id: 13, name: 'FAPET (A12)',                      latitude: -6.924417, longitude: 107.773277 },
      { id: 14, name: 'Lapmer (A13)',                     latitude: -6.924654, longitude: 107.773376 },
      { id: 15, name: 'LAB Sentral (A14)',                latitude: -6.926453, longitude: 107.774252 },
      { id: 16, name: 'FAPSI (A15)',                      latitude: -6.927475, longitude: 107.774727 },
      { id: 17, name: 'Kandaga (A16)',                    latitude: -6.928343, longitude: 107.775137 },

      // ── Jalur C (kode C01–C08) ────────────────────────────────────────────
      { id: 18, name: 'FKEP (C01)',                       latitude: -6.928108, longitude: 107.774936 },
      { id: 19, name: 'Kimia (C02)',                      latitude: -6.926222, longitude: 107.774071 },
      { id: 20, name: 'Statistika (C03)',                 latitude: -6.924713, longitude: 107.773312 },
      { id: 21, name: 'FTG (C04)',                        latitude: -6.922830, longitude: 107.772850 },
      { id: 22, name: 'Bunderan Alfa X (C05)',            latitude: -6.922331, longitude: 107.772582 },
      { id: 23, name: 'Rektorat (C06)',                   latitude: -6.921659, longitude: 107.771112 },
      { id: 24, name: 'FPIK (C07)',                       latitude: -6.922374, longitude: 107.770273 },
      { id: 25, name: 'Halte Rektorat (C08)',             latitude: -6.921017, longitude: 107.771536 },

      // ── Jalur B (kode B02–B14, urutan pergi: B02→B14) ────────────────────
      { id: 26, name: 'Halte FISIP (B02)',                latitude: -6.928777, longitude: 107.777395 },
      { id: 27, name: 'FIB Bawah Gerbang (B03)',         latitude: -6.927891, longitude: 107.777680 },
      { id: 28, name: 'FIB (B04)',                        latitude: -6.926916, longitude: 107.777524 },
      { id: 29, name: 'FIKOM Gerbang Soshum (B05)',       latitude: -6.925533, longitude: 107.776813 },
      { id: 30, name: 'FIKOM (B06)',                      latitude: -6.924764, longitude: 107.775716 },
      { id: 31, name: 'FEB (B07)',                        latitude: -6.923366, longitude: 107.774658 },
      { id: 32, name: 'Alfa X kanan (B08)',               latitude: -6.922087, longitude: 107.773454 },
      { id: 33, name: 'Alfa X (B09)',                     latitude: -6.922353, longitude: 107.772967 },
      { id: 34, name: 'Samping Alfa X (B10)',             latitude: -6.922720, longitude: 107.773313 },
      { id: 35, name: 'FEB (B11)',                        latitude: -6.923679, longitude: 107.774036 },
      { id: 36, name: 'FIKOM (B12)',                      latitude: -6.925495, longitude: 107.774834 },
      { id: 37, name: 'FH (B13)',                         latitude: -6.927071, longitude: 107.775544 },
      { id: 38, name: 'Kandaga samping (B14)',            latitude: -6.928045, longitude: 107.775954 },
    ]

    for (const stop of stopsData) {
      await prisma.stops.upsert({
        where: { id: stop.id },
        update: { name: stop.name, latitude: stop.latitude, longitude: stop.longitude },
        create: stop,
      })
    }

    // ─── 4. Seed Route Stops ───────────────────────────────────────────────────
    // Urutan halte per jalur sesuai arah perjalanan nyata:
    //
    // JALUR A (IPA/Saintek):
    //   MRU(1) → A02(3)→A03(4)→A04(5)→A05(6)→A06(7)→A07(8)→A08(9)→
    //   A09(10)→A10(11)→A11(12)→A12(13)→A13(14)→A14(15)→A15(16)→A16(17)→
    //   FKG(2) → MRU(1)
    //
    // JALUR B (IPS/Soshum):
    //   MRU(1) → FKG(2) → B02(26)→B03(27)→B04(28)→B05(29)→B06(30)→B07(31)→
    //   B08(32)→B09(33)→B10(34)→B11(35)→B12(36)→B13(37)→B14(38)→
    //   FKG(2) → MRU(1)
    //
    // JALUR C (Tengah):
    //   MRU(1) → FKG(2) → C01(18)→C02(19)→C03(20)→C04(21)→C05(22)→
    //   C06(23)→C07(24)→C08(25) → [ikut jalur B balik] →
    //   B09(33)→B10(34)→B11(35)→B12(36)→B13(37)→B14(38)→
    //   FKG(2) → MRU(1)

    const routeStopsData: { route_id: number; stop_id: number; stop_order: number }[] = [
      // ── JALUR A ────────────────────────────────────────────────────────────
      { route_id: 1, stop_id: 1,  stop_order: 1  }, // Pangkalan Odong MRU
      { route_id: 1, stop_id: 3,  stop_order: 2  }, // Halte depan FK (A02)
      { route_id: 1, stop_id: 4,  stop_order: 3  }, // Halte depan FAPSI (A03)
      { route_id: 1, stop_id: 5,  stop_order: 4  }, // Halte depan FMIPA luar (A04)
      { route_id: 1, stop_id: 6,  stop_order: 5  }, // Halte depan Biologi (A05)
      { route_id: 1, stop_id: 7,  stop_order: 6  }, // Halte FAPERTA Saintek (A06)
      { route_id: 1, stop_id: 8,  stop_order: 7  }, // Halte FAPET (A07)
      { route_id: 1, stop_id: 9,  stop_order: 8  }, // Halte FPIK (A08)
      { route_id: 1, stop_id: 10, stop_order: 9  }, // Halte depan Balwil 1 (A09)
      { route_id: 1, stop_id: 11, stop_order: 10 }, // Farmasi (A10)
      { route_id: 1, stop_id: 12, stop_order: 11 }, // Elektro (A11)
      { route_id: 1, stop_id: 13, stop_order: 12 }, // FAPET (A12)
      { route_id: 1, stop_id: 14, stop_order: 13 }, // Lapmer (A13)
      { route_id: 1, stop_id: 15, stop_order: 14 }, // LAB Sentral (A14)
      { route_id: 1, stop_id: 16, stop_order: 15 }, // FAPSI (A15)
      { route_id: 1, stop_id: 17, stop_order: 16 }, // Kandaga (A16)
      { route_id: 1, stop_id: 2,  stop_order: 17 }, // FKG (kembali)
      { route_id: 1, stop_id: 1,  stop_order: 18 }, // Pangkalan Odong MRU (akhir)

      // ── JALUR B ────────────────────────────────────────────────────────────
      { route_id: 2, stop_id: 1,  stop_order: 1  }, // Pangkalan Odong MRU
      { route_id: 2, stop_id: 2,  stop_order: 2  }, // FKG
      { route_id: 2, stop_id: 26, stop_order: 3  }, // Halte FISIP (B02)
      { route_id: 2, stop_id: 27, stop_order: 4  }, // FIB Bawah Gerbang (B03)
      { route_id: 2, stop_id: 28, stop_order: 5  }, // FIB (B04)
      { route_id: 2, stop_id: 29, stop_order: 6  }, // FIKOM Gerbang Soshum (B05)
      { route_id: 2, stop_id: 30, stop_order: 7  }, // FIKOM (B06)
      { route_id: 2, stop_id: 31, stop_order: 8  }, // FEB (B07)
      { route_id: 2, stop_id: 32, stop_order: 9  }, // Alfa X kanan (B08)
      { route_id: 2, stop_id: 33, stop_order: 10 }, // Alfa X (B09)
      { route_id: 2, stop_id: 34, stop_order: 11 }, // Samping Alfa X (B10)
      { route_id: 2, stop_id: 35, stop_order: 12 }, // FEB (B11)
      { route_id: 2, stop_id: 36, stop_order: 13 }, // FIKOM (B12)
      { route_id: 2, stop_id: 37, stop_order: 14 }, // FH (B13)
      { route_id: 2, stop_id: 38, stop_order: 15 }, // Kandaga samping (B14)
      { route_id: 2, stop_id: 2,  stop_order: 16 }, // FKG (kembali)
      { route_id: 2, stop_id: 1,  stop_order: 17 }, // Pangkalan Odong MRU (akhir)

      // ── JALUR C ────────────────────────────────────────────────────────────
      { route_id: 3, stop_id: 1,  stop_order: 1  }, // Pangkalan Odong MRU
      { route_id: 3, stop_id: 2,  stop_order: 2  }, // FKG
      { route_id: 3, stop_id: 18, stop_order: 3  }, // FKEP (C01)
      { route_id: 3, stop_id: 19, stop_order: 4  }, // Kimia (C02)
      { route_id: 3, stop_id: 20, stop_order: 5  }, // Statistika (C03)
      { route_id: 3, stop_id: 21, stop_order: 6  }, // FTG (C04)
      { route_id: 3, stop_id: 22, stop_order: 7  }, // Bunderan Alfa X (C05)
      { route_id: 3, stop_id: 23, stop_order: 8  }, // Rektorat (C06)
      { route_id: 3, stop_id: 24, stop_order: 9  }, // FPIK (C07)
      { route_id: 3, stop_id: 25, stop_order: 10 }, // Halte Rektorat (C08)
      // → setelah C08 ikut jalur kembali Bus B (B09 → B14)
      { route_id: 3, stop_id: 33, stop_order: 11 }, // Alfa X (B09)
      { route_id: 3, stop_id: 34, stop_order: 12 }, // Samping Alfa X (B10)
      { route_id: 3, stop_id: 35, stop_order: 13 }, // FEB (B11)
      { route_id: 3, stop_id: 36, stop_order: 14 }, // FIKOM (B12)
      { route_id: 3, stop_id: 37, stop_order: 15 }, // FH (B13)
      { route_id: 3, stop_id: 38, stop_order: 16 }, // Kandaga samping (B14)
      { route_id: 3, stop_id: 2,  stop_order: 17 }, // FKG (kembali)
      { route_id: 3, stop_id: 1,  stop_order: 18 }, // Pangkalan Odong MRU (akhir)
    ]

    // Clear dan re-seed route_stops
    await prisma.route_stops.deleteMany({})
    for (const rs of routeStopsData) {
      await prisma.route_stops.create({ data: rs })
    }

    // ─── 5. Seed Trip ──────────────────────────────────────────────────────────
    const buses = await prisma.buses.findMany()
    const tripsData = [
      { bus_id: buses[0]?.id || 1, route_id: 1, status: 'active', started_at: new Date() },
    ]

    // Selesaikan semua trip aktif lama
    await prisma.trips.updateMany({
      where: { status: 'active' },
      data: { status: 'completed', ended_at: new Date() },
    })

    for (const trip of tripsData) {
      await prisma.trips.create({ data: trip })
    }

    // ─── 6. Seed initial bus_location (posisi awal = Pangkalan Odong MRU) ─────
    const newTrips = await prisma.trips.findMany({ where: { status: 'active' } })

    for (let i = 0; i < newTrips.length; i++) {
      await prisma.bus_locations.create({
        data: {
          trip_id: newTrips[i].id,
          latitude: -6.931126,  // Pangkalan Odong MRU
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
