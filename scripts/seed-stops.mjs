import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Master Data Halte ─────────────────────────────────────────────────────
const stopsData = [
  // Titik awal & transit bersama
  { id: 1,  name: 'Pangkalan Odong MRU',             latitude: -6.931126, longitude: 107.774791 },
  { id: 2,  name: 'FKG',                              latitude: -6.929892, longitude: 107.775532 },
  // Jalur A (A02–A16 + A13 Lapmer)
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
  // Jalur C (C01–C08)
  { id: 18, name: 'FKEP (C01)',                       latitude: -6.928108, longitude: 107.774936 },
  { id: 19, name: 'Kimia (C02)',                      latitude: -6.926222, longitude: 107.774071 },
  { id: 20, name: 'Statistika (C03)',                 latitude: -6.924713, longitude: 107.773312 },
  { id: 21, name: 'FTG (C04)',                        latitude: -6.922830, longitude: 107.772850 },
  { id: 22, name: 'Bunderan Alfa X (C05)',            latitude: -6.922331, longitude: 107.772582 },
  { id: 23, name: 'Rektorat (C06)',                   latitude: -6.921659, longitude: 107.771112 },
  { id: 24, name: 'FPIK (C07)',                       latitude: -6.922374, longitude: 107.770273 },
  { id: 25, name: 'Halte Rektorat (C08)',             latitude: -6.921017, longitude: 107.771536 },
  // Jalur B (B02–B14, urutan pergi)
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

// ─── Route Stops per Jalur ────────────────────────────────────────────────
const routeStopsData = [
  // JALUR A: MRU → A02→...→A16 → FKG → MRU
  { route_id: 1, stop_id: 1,  stop_order: 1  },
  { route_id: 1, stop_id: 3,  stop_order: 2  },
  { route_id: 1, stop_id: 4,  stop_order: 3  },
  { route_id: 1, stop_id: 5,  stop_order: 4  },
  { route_id: 1, stop_id: 6,  stop_order: 5  },
  { route_id: 1, stop_id: 7,  stop_order: 6  },
  { route_id: 1, stop_id: 8,  stop_order: 7  },
  { route_id: 1, stop_id: 9,  stop_order: 8  },
  { route_id: 1, stop_id: 10, stop_order: 9  },
  { route_id: 1, stop_id: 11, stop_order: 10 },
  { route_id: 1, stop_id: 12, stop_order: 11 },
  { route_id: 1, stop_id: 13, stop_order: 12 },
  { route_id: 1, stop_id: 14, stop_order: 13 },
  { route_id: 1, stop_id: 15, stop_order: 14 },
  { route_id: 1, stop_id: 16, stop_order: 15 },
  { route_id: 1, stop_id: 17, stop_order: 16 },
  { route_id: 1, stop_id: 2,  stop_order: 17 }, // FKG (kembali)
  { route_id: 1, stop_id: 1,  stop_order: 18 }, // MRU (akhir)
  // JALUR B: MRU → FKG → B02→...→B14 → FKG → MRU
  { route_id: 2, stop_id: 1,  stop_order: 1  },
  { route_id: 2, stop_id: 2,  stop_order: 2  }, // FKG
  { route_id: 2, stop_id: 26, stop_order: 3  },
  { route_id: 2, stop_id: 27, stop_order: 4  },
  { route_id: 2, stop_id: 28, stop_order: 5  },
  { route_id: 2, stop_id: 29, stop_order: 6  },
  { route_id: 2, stop_id: 30, stop_order: 7  },
  { route_id: 2, stop_id: 31, stop_order: 8  },
  { route_id: 2, stop_id: 32, stop_order: 9  },
  { route_id: 2, stop_id: 33, stop_order: 10 },
  { route_id: 2, stop_id: 34, stop_order: 11 },
  { route_id: 2, stop_id: 35, stop_order: 12 },
  { route_id: 2, stop_id: 36, stop_order: 13 },
  { route_id: 2, stop_id: 37, stop_order: 14 },
  { route_id: 2, stop_id: 38, stop_order: 15 },
  { route_id: 2, stop_id: 2,  stop_order: 16 }, // FKG (kembali)
  { route_id: 2, stop_id: 1,  stop_order: 17 }, // MRU (akhir)
  // JALUR C: MRU → FKG → C01→...→C08 → B09→...→B14 → FKG → MRU
  { route_id: 3, stop_id: 1,  stop_order: 1  },
  { route_id: 3, stop_id: 2,  stop_order: 2  }, // FKG
  { route_id: 3, stop_id: 18, stop_order: 3  }, // C01
  { route_id: 3, stop_id: 19, stop_order: 4  }, // C02
  { route_id: 3, stop_id: 20, stop_order: 5  }, // C03
  { route_id: 3, stop_id: 21, stop_order: 6  }, // C04
  { route_id: 3, stop_id: 22, stop_order: 7  }, // C05
  { route_id: 3, stop_id: 23, stop_order: 8  }, // C06
  { route_id: 3, stop_id: 24, stop_order: 9  }, // C07
  { route_id: 3, stop_id: 25, stop_order: 10 }, // C08
  { route_id: 3, stop_id: 33, stop_order: 11 }, // B09 (ikut jalur B balik)
  { route_id: 3, stop_id: 34, stop_order: 12 }, // B10
  { route_id: 3, stop_id: 35, stop_order: 13 }, // B11
  { route_id: 3, stop_id: 36, stop_order: 14 }, // B12
  { route_id: 3, stop_id: 37, stop_order: 15 }, // B13
  { route_id: 3, stop_id: 38, stop_order: 16 }, // B14
  { route_id: 3, stop_id: 2,  stop_order: 17 }, // FKG (kembali)
  { route_id: 3, stop_id: 1,  stop_order: 18 }, // MRU (akhir)
]

async function main() {
  console.log('🔄 Update data halte & rute ke database...\n')

  // Upsert routes
  const routes = [
    { id: 1, name: 'Jalur A (IPA/Saintek)', description: 'Rute sisi barat kampus: MRU → A02–A16 (Saintek) → FKG → MRU' },
    { id: 2, name: 'Jalur B (IPS/Soshum)',  description: 'Rute sisi timur kampus: MRU → FKG → B02–B14 (Soshum) → FKG → MRU' },
    { id: 3, name: 'Jalur C (Tengah)',       description: 'Rute tengah kampus: MRU → FKG → C01–C08 → B09–B14 → FKG → MRU' },
  ]
  for (const r of routes) {
    await prisma.routes.upsert({ where: { id: r.id }, update: r, create: r })
    console.log(`  🛣️  Route ${r.id}: ${r.name}`)
  }

  // Upsert stops
  console.log('\n📍 Menyimpan halte...')
  for (const s of stopsData) {
    await prisma.stops.upsert({
      where: { id: s.id },
      update: { name: s.name, latitude: s.latitude, longitude: s.longitude },
      create: s,
    })
    console.log(`  ✅ [${String(s.id).padStart(2,'0')}] ${s.name}`)
  }

  // Reset dan isi ulang route_stops
  console.log('\n🔄 Memperbarui urutan halte per jalur...')
  await prisma.route_stops.deleteMany({})
  for (const rs of routeStopsData) {
    await prisma.route_stops.create({ data: rs })
  }

  // Summary per jalur
  const jalurA = routeStopsData.filter(r => r.route_id === 1)
  const jalurB = routeStopsData.filter(r => r.route_id === 2)
  const jalurC = routeStopsData.filter(r => r.route_id === 3)

  console.log('\n🎉 Selesai! Ringkasan:')
  console.log(`  🔵 Jalur A (Saintek) : ${jalurA.length} titik pemberhentian`)
  console.log(`  🩷 Jalur B (Soshum)  : ${jalurB.length} titik pemberhentian`)
  console.log(`  💚 Jalur C (Tengah)  : ${jalurC.length} titik pemberhentian`)
  console.log(`  📦 Total stops       : ${stopsData.length} halte unik`)
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
