/**
 * MQTT Bridge Service — Kinetic Transit
 * 
 * Service ini berjalan secara paralel dengan Next.js dev server.
 * Ia subscribe ke topik MQTT broker (HiveMQ) dan menulis data GPS
 * yang dikirim ESP32 ke dalam database MySQL via Prisma.
 * 
 * Jalankan dengan: node scripts/mqtt-bridge.mjs
 */

import mqtt from 'mqtt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Konfigurasi MQTT dari .env
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com'
const MQTT_PORT  = parseInt(process.env.MQTT_PORT || '1883')
const USERNAME   = process.env.MQTT_USERNAME || ''
const PASSWORD   = process.env.MQTT_PASSWORD || ''
const TOPIC      = process.env.MQTT_TOPIC || 'kinetic-transit/gps'

// ─── Koneksi ke MQTT Broker ───────────────────────────────────────────────
const client = mqtt.connect(BROKER_URL, {
  port: MQTT_PORT,
  username: USERNAME || undefined,
  password: PASSWORD || undefined,
  clientId: `kinetic-bridge-${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 5000,
  connectTimeout: 10000,
})

client.on('connect', () => {
  console.log(`✅ MQTT Bridge terhubung ke ${BROKER_URL}`)
  console.log(`📡 Subscribe ke topik: ${TOPIC}`)
  client.subscribe(TOPIC, { qos: 1 }, (err) => {
    if (err) console.error('❌ Subscribe gagal:', err.message)
  })
})

client.on('reconnect', () => {
  console.log('🔄 Mencoba reconnect ke MQTT broker...')
})

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message)
})

// ─── Handle Pesan Masuk dari ESP32 ────────────────────────────────────────
client.on('message', async (topic, messageBuffer) => {
  const raw = messageBuffer.toString()
  console.log(`📨 [${new Date().toLocaleTimeString('id-ID')}] Pesan dari ${topic}:`, raw)

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    console.warn('⚠️  Payload bukan JSON valid, dilewati.')
    return
  }

  // Validasi field yang wajib ada
  const { license_plate, latitude, longitude, speed } = payload
  if (!license_plate || latitude == null || longitude == null) {
    console.warn('⚠️  Payload tidak lengkap (butuh license_plate, latitude, longitude):', payload)
    return
  }

  try {
    // 1. Cari bus berdasarkan plat nomor
    const bus = await prisma.buses.findUnique({ where: { license_plate } })
    if (!bus) {
      console.warn(`⚠️  Bus dengan plat "${license_plate}" tidak ditemukan di DB.`)
      return
    }

    // 2. Cari trip yang sedang aktif
    const activeTrip = await prisma.trips.findFirst({
      where: { bus_id: bus.id, status: 'active' },
    })
    if (!activeTrip) {
      console.warn(`⚠️  Tidak ada trip aktif untuk bus "${bus.name}" (${license_plate}).`)
      return
    }

    // 3. Simpan koordinat ke tabel bus_locations
    const saved = await prisma.bus_locations.create({
      data: {
        trip_id: activeTrip.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed != null ? parseFloat(speed) : null,
        recorded_at: new Date(),
      },
    })

    // 4. Hitung ulang ETA ke setiap halte di rute ini
    const trip = await prisma.trips.findUnique({
      where: { id: activeTrip.id },
      include: {
        routes: {
          include: {
            route_stops: {
              include: { stops: true },
              orderBy: { stop_order: 'asc' },
            },
          },
        },
      },
    })

    if (trip) {
      const busLat = parseFloat(latitude)
      const busLng = parseFloat(longitude)
      const busSpeed = speed != null ? parseFloat(speed) : 15 // default 15 km/h

      for (const rs of trip.routes.route_stops) {
        const stopLat = Number(rs.stops.latitude)
        const stopLng = Number(rs.stops.longitude)

        // Haversine distance
        const R = 6371
        const dLat = ((stopLat - busLat) * Math.PI) / 180
        const dLng = ((stopLng - busLng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((busLat * Math.PI) / 180) *
            Math.cos((stopLat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3 // road factor

        const etaMinutes = Math.max(1, Math.round((dist / Math.max(busSpeed, 5)) * 60))
        const estimatedArrival = new Date(Date.now() + etaMinutes * 60000)

        await prisma.etas.upsert({
          where: {
            trip_id_stop_id: {
              trip_id: activeTrip.id,
              stop_id: rs.stop_id,
            },
          },
          update: {
            estimated_arrival: estimatedArrival,
            calculated_at: new Date(),
          },
          create: {
            trip_id: activeTrip.id,
            stop_id: rs.stop_id,
            estimated_arrival: estimatedArrival,
            calculated_at: new Date(),
          },
        })
      }
    }

    console.log(
      `✅ Disimpan → trip_id=${activeTrip.id} | lat=${saved.latitude} lng=${saved.longitude} | 🚌 ${bus.name}`
    )
  } catch (err) {
    console.error('❌ Gagal menyimpan ke DB:', err.message)
  }
})

// ─── Graceful shutdown ─────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down MQTT Bridge...')
  client.end()
  await prisma.$disconnect()
  process.exit(0)
})
