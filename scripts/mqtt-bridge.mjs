/**
 * MQTT Bridge Service — Kinetic Transit
 * 
 * Layanan ini berjalan terpisah dari Next.js, berlangganan topik MQTT,
 * dan menyimpan data GPS dari ESP32 ke TiDB melalui Prisma.
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
const MAX_SPEED_KMH = 999.99 // bus_locations.speed uses DECIMAL(5, 2).

function parseTelemetryNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return NaN

  const text = value.trim()
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
  return decimal.test(text) ? Number(text) : NaN
}

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
  console.log(`MQTT Bridge terhubung ke ${BROKER_URL}`)
  console.log(`Subscribe ke topik: ${TOPIC}`)
  client.subscribe(TOPIC, { qos: 1 }, (err) => {
    if (err) console.error('Subscribe gagal:', err.message)
  })
})

client.on('reconnect', () => {
  console.log('Mencoba reconnect ke MQTT broker...')
})

client.on('error', (err) => {
  console.error('MQTT Error:', err.message)
})

// ─── Handle Pesan Masuk dari ESP32 ────────────────────────────────────────
client.on('message', async (_topic, messageBuffer) => {
  let payload
  try {
    payload = JSON.parse(messageBuffer.toString())
  } catch {
    console.warn('Payload bukan JSON valid, dilewati.')
    return
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    console.warn('Payload harus berupa objek JSON, dilewati.')
    return
  }

  const { license_plate } = payload
  if (typeof license_plate !== 'string' || license_plate.trim() === '') {
    console.warn('Payload tidak memiliki pelat nomor yang valid, dilewati.')
    return
  }

  const latitude = parseTelemetryNumber(payload.latitude)
  const longitude = parseTelemetryNumber(payload.longitude)
  const speed = payload.speed == null ? null : parseTelemetryNumber(payload.speed)

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    console.warn('Payload memiliki koordinat tidak valid, dilewati.')
    return
  }

  if (speed !== null && (!Number.isFinite(speed) || speed < 0 || speed > MAX_SPEED_KMH)) {
    console.warn('Payload memiliki kecepatan tidak valid, dilewati.')
    return
  }

  try {
    // 1. Cari bus berdasarkan plat nomor
    const bus = await prisma.buses.findUnique({ where: { license_plate } })
    if (!bus) {
      console.warn('Armada tidak terdaftar, pesan dilewati.')
      return
    }

    // 2. Cari trip yang sedang aktif
    const activeTrip = await prisma.trips.findFirst({
      where: { bus_id: bus.id, status: 'active' },
    })
    if (!activeTrip) {
      console.warn('Armada tidak memiliki perjalanan aktif, pesan dilewati.')
      return
    }

    // 3. Simpan koordinat ke tabel bus_locations.
    //    ETA tidak lagi dihitung di sini — cukup simpan lokasi, dan ETA
    //    dihitung on-read oleh GET /api/live (selalu segar, tidak bisa basi).
    await prisma.bus_locations.create({
      data: {
        trip_id: activeTrip.id,
        latitude,
        longitude,
        speed,
        recorded_at: new Date(),
      },
    })

    // 4. Catat prediksi & deteksi kedatangan untuk evaluasi akurasi ETA.
    const routeData = await getRouteData(activeTrip.route_id)
    if (routeData) {
      await processLocation(prisma, {
        tripId: activeTrip.id,
        lat: latitude,
        lng: longitude,
        stops: routeData.stops,
        waypoints: routeData.waypoints,
        state: loggerState,
        // GPS ESP32 sungguhan → satu-satunya sumber yang sah dipakai sebagai
        // angka akurasi di laporan.
        source: 'field',
      })
    }

    console.log(`Lokasi diproses untuk trip_id=${activeTrip.id}.`)
  } catch (err) {
    if (typeof err?.code === 'string' && /^P\d{4}$/.test(err.code)) {
      console.error(`Gagal memproses lokasi: ${err.code}.`)
    } else {
      console.error('Gagal memproses lokasi.')
    }
  }
})

// ─── Graceful shutdown ─────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\nShutting down MQTT Bridge...')
  client.end()
  await prisma.$disconnect()
  process.exit(0)
})
