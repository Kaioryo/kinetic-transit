import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

async function main() {
  console.log('🔄 Mengupdate titik pemberhentian ke database...\n')

  // Upsert semua 37 halte
  for (const stop of stopsData) {
    await prisma.stops.upsert({
      where: { id: stop.id },
      update: { name: stop.name, latitude: stop.latitude, longitude: stop.longitude },
      create: stop,
    })
    console.log(`  ✅ [${String(stop.id).padStart(2,'0')}] ${stop.name}`)
  }

  // Update route_stops (hapus lama, isi baru)
  console.log('\n🔄 Memperbarui urutan halte di rute...')
  await prisma.route_stops.deleteMany({})
  for (let i = 0; i < stopsData.length; i++) {
    await prisma.route_stops.create({
      data: { route_id: 1, stop_id: i + 1, stop_order: i + 1 },
    })
  }

  console.log(`\n🎉 Selesai! ${stopsData.length} titik pemberhentian berhasil disimpan ke database.`)
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
