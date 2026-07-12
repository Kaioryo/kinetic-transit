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
import { createLoggerState, processLocation } from '../lib/eta-logger.mjs'
import { parseWaypoints } from '../lib/eta-engine.mjs'

const prisma = new PrismaClient()
const loggerState = createLoggerState()

// Cache data rute (halte terurut + waypoints) per route_id agar tidak query
// berat tiap pesan. Rute jarang berubah; cache dibuang otomatis tiap 5 menit.
const routeCache = new Map()
setInterval(() => routeCache.clear(), 5 * 60 * 1000)

async function getRouteData(routeId) {
  if (routeCache.has(routeId)) return routeCache.get(routeId)
  const route = await prisma.routes.findUnique({
    where: { id: routeId },
    include: { route_stops: { include: { stops: true }, orderBy: { stop_order: 'asc' } } },
  })
  if (!route) return null
  const data = {
    stops: route.route_stops.map((rs) => ({
      stop_id: rs.stop_id,
      name: rs.stops.name,
      lat: Number(rs.stops.latitude),
      lng: Number(rs.stops.longitude),
    })),
    waypoints: parseWaypoints(route.waypoints),
  }
  routeCache.set(routeId, data)
  return data
}

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

    // 3. Simpan koordinat ke tabel bus_locations.
    //    ETA tidak lagi dihitung di sini — cukup simpan lokasi, dan ETA
    //    dihitung on-read oleh GET /api/live (selalu segar, tidak bisa basi).
    const saved = await prisma.bus_locations.create({
      data: {
        trip_id: activeTrip.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed != null ? parseFloat(speed) : null,
        recorded_at: new Date(),
      },
    })

    // 4. Catat prediksi & deteksi kedatangan untuk evaluasi akurasi ETA.
    const routeData = await getRouteData(activeTrip.route_id)
    if (routeData) {
      await processLocation(prisma, {
        tripId: activeTrip.id,
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
        stops: routeData.stops,
        waypoints: routeData.waypoints,
        state: loggerState,
      })
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
