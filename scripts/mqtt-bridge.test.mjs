import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as etaEngine from '../lib/eta-engine.mjs'
import * as etaLogger from '../lib/eta-logger.mjs'

const source = await readFile(new URL('./mqtt-bridge.mjs', import.meta.url), 'utf8')
const valid = { license_plate: 'UJI-LOKAL', latitude: -6.93, longitude: 107.77, speed: 15.2 }

async function receive(raw, { busExists = true, tripExists = true, databaseError } = {}) {
  const handlers = new Map()
  const calls = []
  const locations = []
  const predictions = []
  const logs = []
  const warnings = []
  const errors = []
  const db = {
    buses: {
      findUnique: async ({ where }) => {
        calls.push('buses.findUnique')
        assert.equal(where.license_plate, valid.license_plate)
        if (databaseError) throw databaseError
        return busExists ? { id: 1, name: 'Uji lokal' } : null
      },
    },
    trips: {
      findFirst: async ({ where }) => {
        calls.push('trips.findFirst')
        assert.equal(where.bus_id, 1)
        assert.equal(where.status, 'active')
        return tripExists ? { id: 2, route_id: 3 } : null
      },
      update: async () => { calls.push('trips.update') },
    },
    routes: {
      findUnique: async () => {
        calls.push('routes.findUnique')
        return {
          waypoints: null,
          route_stops: [
            { stop_id: 4, stops: { name: 'A', latitude: -6.93, longitude: 107.77 } },
            { stop_id: 5, stops: { name: 'B', latitude: -6.92, longitude: 107.77 } },
          ],
        }
      },
    },
    bus_locations: {
      create: async ({ data }) => {
        calls.push('bus_locations.create')
        locations.push(data)
        return data
      },
      findMany: async () => {
        calls.push('bus_locations.findMany')
        return locations
      },
    },
    eta_logs: {
      create: async ({ data }) => {
        calls.push('eta_logs.create')
        predictions.push(data)
        return { id: 1 }
      },
    },
  }

  const context = createContext({
    console: {
      log: (...args) => logs.push(args),
      warn: (...args) => warnings.push(args),
      error: (...args) => errors.push(args),
    },
    process: { env: {}, on() {} },
    setInterval() {},
  })
  const dependencies = {
    mqtt: { default: { connect: () => ({ on: (event, handler) => handlers.set(event, handler) }) } },
    '@prisma/client': { PrismaClient: class { constructor() { return db } } },
    '../lib/eta-engine.mjs': etaEngine,
    '../lib/eta-logger.mjs': etaLogger,
  }
  const bridge = new SourceTextModule(source, { context })
  await bridge.link((name) => {
    const exports = dependencies[name]
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await bridge.evaluate()
  await handlers.get('message')('kinetic-transit/gps', Buffer.from(raw))
  return { calls, locations, predictions, logs, warnings, errors }
}

const encode = (changes) => JSON.stringify({ ...valid, ...changes })

const invalidCases = [
  ['JSON rusak', '{'],
  ['JSON null', 'null'],
  ['JSON larik', '[]'],
  ['JSON primitif', '42'],
  ['pelat kosong', encode({ license_plate: ' ' })],
  ['pelat nonteks', encode({ license_plate: 123 })],
  ['latitude hilang', encode({ latitude: undefined })],
  ['latitude di atas 90', encode({ latitude: 90.01 })],
  ['latitude di bawah -90', encode({ latitude: -90.01 })],
  ['longitude di atas 180', encode({ longitude: 180.01 })],
  ['longitude di bawah -180', encode({ longitude: -180.01 })],
  ['koordinat dengan akhiran teks', encode({ latitude: '-6.93xyz' })],
  ['koordinat boolean', encode({ longitude: true })],
  ['koordinat NaN berbentuk teks', encode({ longitude: 'NaN' })],
  ['koordinat kosong', encode({ longitude: '  ' })],
  ['angka JSON tidak berhingga', encode({ speed: 'OVERFLOW' }).replace('"OVERFLOW"', '1e309')],
  ['kecepatan negatif', encode({ speed: -0.01 })],
  ['kecepatan berupa teks bukan angka', encode({ speed: 'cepat' })],
  ['kecepatan di luar kapasitas kolom', encode({ speed: 1000 })],
]

for (const [name, raw] of invalidCases) {
  test(`tolak ${name} sebelum kueri basis data`, async () => {
    const result = await receive(raw)
    assert.deepEqual(result.calls, [])
    assert.equal(result.locations.length, 0)
    assert.equal(result.predictions.length, 0)
    assert.deepEqual(result.logs, [])
    assert.equal(result.warnings.length, 1)
    assert.deepEqual(result.errors, [])
  })
}

const validCases = [
  ['angka JSON', {}, [-6.93, 107.77, 15.2]],
  ['string angka desimal dan eksponen', { latitude: ' -6.93 ', longitude: '1.0777e2', speed: '15.2' }, [-6.93, 107.77, 15.2]],
  ['kecepatan nol', { speed: 0 }, [-6.93, 107.77, 0]],
  ['kecepatan null', { speed: null }, [-6.93, 107.77, null]],
  ['kecepatan tidak dikirim', { speed: undefined }, [-6.93, 107.77, null]],
  ['batas koordinat atas dan kecepatan maksimum', { latitude: 90, longitude: 180, speed: 999.99 }, [90, 180, 999.99]],
  ['batas koordinat bawah', { latitude: -90, longitude: -180 }, [-90, -180, 15.2]],
]

for (const [name, changes, expected] of validCases) {
  test(`proses ${name} melalui penyimpanan lokasi dan pencatatan ETA`, async () => {
    const result = await receive(encode(changes))
    assert.deepEqual(result.calls, [
      'buses.findUnique', 'trips.findFirst', 'bus_locations.create', 'routes.findUnique',
      'trips.update', 'bus_locations.findMany', 'eta_logs.create',
    ])
    assert.deepEqual(result.warnings, [])
    assert.deepEqual(result.errors, [])
    assert.equal(result.locations.length, 1)
    const { trip_id, latitude, longitude, speed, recorded_at } = result.locations[0]
    assert.equal(trip_id, 2)
    assert.deepEqual([latitude, longitude, speed], expected)
    assert.ok(Number.isFinite(recorded_at.getTime()))
    assert.equal(result.predictions.length, 1)
    assert.equal(result.predictions[0].trip_id, 2)
    assert.equal(result.predictions[0].source, 'field')
  })
}

test('lewati armada yang tidak terdaftar', async () => {
  const result = await receive(encode({}), { busExists: false })
  assert.deepEqual(result.calls, ['buses.findUnique'])
  assert.equal(result.locations.length, 0)
  assert.equal(result.predictions.length, 0)
})

test('lewati armada tanpa perjalanan aktif', async () => {
  const result = await receive(encode({}), { tripExists: false })
  assert.deepEqual(result.calls, ['buses.findUnique', 'trips.findFirst'])
  assert.equal(result.locations.length, 0)
  assert.equal(result.predictions.length, 0)
})

test('log hanya memuat kategori penolakan, ID perjalanan, atau kode kesalahan', async () => {
  const invalid = await receive('teks-pribadi-dari-pesan-rusak')
  assert.deepEqual(invalid.logs, [])
  assert.deepEqual(invalid.warnings, [['Payload bukan JSON valid, dilewati.']])

  const notRegistered = await receive(encode({}), { busExists: false })
  assert.deepEqual(notRegistered.warnings, [['Armada tidak terdaftar, pesan dilewati.']])

  const notActive = await receive(encode({}), { tripExists: false })
  assert.deepEqual(notActive.warnings, [['Armada tidak memiliki perjalanan aktif, pesan dilewati.']])

  const saved = await receive(encode({}))
  assert.deepEqual(saved.logs, [['Lokasi diproses untuk trip_id=2.']])

  const databaseError = Object.assign(new Error('Nilai privat dari kueri basis data'), { code: 'P2002' })
  const failure = await receive(encode({}), { databaseError })
  assert.deepEqual(failure.errors, [['Gagal memproses lokasi: P2002.']])
})
