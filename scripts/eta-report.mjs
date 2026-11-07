/**
 * ETA Report — metrik akurasi prediksi kedatangan untuk laporan skripsi.
 *
 * Membaca tabel `eta_logs` (diisi eta-logger) dan menghitung metrik standar yang
 * dipakai literatur prediksi waktu kedatangan bus: MAE, RMSE, dan MAPE.
 * Rujukan: Abdi & Amrit (2021), "A review of travel and arrival-time prediction
 * methods on road networks", PeerJ Computer Science 7:e689 — MAPE dipakai 41%
 * studi, RMSE 28%, MAE 13%; kombinasi MAE+RMSE+MAPE adalah yang paling lazim.
 *
 * PENTING — soal `source`:
 *   field      = GPS ESP32 sungguhan. HANYA ini yang sah dipakai sebagai angka
 *                akurasi sistem di laporan.
 *   simulated  = dummy-bus. TIDAK memvalidasi apa pun: simulator menyusuri polyline
 *                yang sama dengan yang dipakai menghitung ETA dan menuliskan sendiri
 *                kolom speed-nya, jadi ia dinilai terhadap dirinya sendiri. Berguna
 *                untuk memeriksa pipeline, bukan untuk mengklaim akurasi.
 *
 * Jalankan:
 *   npm run eta-report                      (default: --source=field)
 *   npm run eta-report -- --source=simulated
 *   npm run eta-report -- --csv=hasil.csv
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'

const prisma = new PrismaClient()

function argValue(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const SOURCE = argValue('source', 'field')
const CSV_PATH = argValue('csv', 'eta-report.csv')

if (!['field', 'simulated'].includes(SOURCE)) {
  console.error(`--source harus "field" atau "simulated" (diberi: "${SOURCE}")`)
  process.exit(1)
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const round1 = (x) => Math.round(x * 10) / 10

// ─── Ambil prediksi yang sudah punya kedatangan aktual ──────────────────────
const rows = await prisma.eta_logs.findMany({
  where: { source: SOURCE, actual_arrival: { not: null }, error_seconds: { not: null } },
  orderBy: { actual_arrival: 'asc' },
})

const pending = await prisma.eta_logs.count({
  where: { source: SOURCE, actual_arrival: null },
})

console.log(`\n╔═ LAPORAN AKURASI ETA — source = "${SOURCE}"`)

if (rows.length === 0) {
  console.log(`║`)
  console.log(`║  Belum ada prediksi yang selesai (dengan kedatangan aktual) untuk source ini.`)
  console.log(`║  Prediksi menggantung: ${pending}`)
  if (SOURCE === 'field') {
    console.log(`║`)
    console.log(`║  Data lapangan terisi saat ESP32 mengirim GPS lewat mqtt-bridge.`)
    console.log(`║  Lihat FIELD_TEST.md untuk prosedurnya.`)
  }
  console.log(`╚═\n`)
  await prisma.$disconnect()
  process.exit(0)
}

// ─── Metrik ─────────────────────────────────────────────────────────────────
// error_seconds = actual − predicted (+ telat, − lebih cepat).
const errors = rows.map((r) => r.error_seconds)
const absErrors = errors.map(Math.abs)

const mae = mean(absErrors)
const rmse = Math.sqrt(mean(errors.map((e) => e * e)))
const bias = mean(errors)

// MAPE dihitung atas WAKTU TEMPUH (bukan atas jam absolut, yang tidak bermakna):
//   actual_travel    = actual_arrival    − predicted_at
//   predicted_travel = predicted_arrival − predicted_at
//
// MAPE punya kelemahan yang harus diakui: pembaginya waktu tempuh aktual, jadi ia
// MELEDAK saat waktu tempuhnya sangat pendek. Halte di kampus ini berdekatan
// (median waktu tempuh ~30 detik), sehingga meleset 10 detik pada perjalanan 3 detik
// menghasilkan APE >300% — angka yang menyesatkan, bukan cerminan kualitas model.
// Karena itu MAPE hanya dihitung untuk prediksi dengan waktu tempuh aktual ≥ ambang,
// dan jumlah baris yang dilewati SELALU dilaporkan (bukan disembunyikan).
const MIN_TRAVEL_SEC = parseInt(argValue('min-travel', '30'), 10)
const apes = []
let skippedForMape = 0
for (const r of rows) {
  const t0 = new Date(r.predicted_at).getTime()
  const actualTravel = (new Date(r.actual_arrival).getTime() - t0) / 1000
  const predictedTravel = (new Date(r.predicted_arrival).getTime() - t0) / 1000
  if (actualTravel < MIN_TRAVEL_SEC) {
    skippedForMape++
    continue
  }
  apes.push(Math.abs(predictedTravel - actualTravel) / actualTravel)
}
const mape = apes.length > 0 ? mean(apes) * 100 : null

const within = (s) => (absErrors.filter((e) => e <= s).length / rows.length) * 100

console.log(`║`)
console.log(`║  n (prediksi dievaluasi) : ${rows.length}`)
console.log(`║  prediksi menggantung    : ${pending}`)
console.log(`║`)
console.log(`║  MAE   (Mean Absolute Error)          : ${round1(mae)} detik`)
console.log(`║  RMSE  (Root Mean Square Error)       : ${round1(rmse)} detik`)
console.log(
  `║  MAPE  (Mean Absolute Percentage Err) : ${mape == null ? 'n/a' : round1(mape) + ' %'}` +
    `   [n=${apes.length}, waktu tempuh ≥ ${MIN_TRAVEL_SEC}s]`
)
if (skippedForMape > 0) {
  console.log(
    `║          ${skippedForMape} baris dilewati dari MAPE (waktu tempuh < ${MIN_TRAVEL_SEC}s —` +
      ` pembagi terlalu kecil, rasionya meledak). Ubah dengan --min-travel=N.`
  )
}
console.log(`║  Bias  (mean error, + = telat)        : ${round1(bias)} detik`)
console.log(`║`)
console.log(`║  Meleset ≤ 60 detik  : ${round1(within(60))} %`)
console.log(`║  Meleset ≤ 120 detik : ${round1(within(120))} %`)
console.log(`║  Error terburuk      : ${Math.max(...absErrors)} detik`)

// ─── Rincian per halte (terburuk di atas) ───────────────────────────────────
const stops = await prisma.stops.findMany()
const stopName = new Map(stops.map((s) => [s.id, s.name]))

const grouped = new Map()
for (const r of rows) {
  if (!grouped.has(r.stop_id)) grouped.set(r.stop_id, [])
  grouped.get(r.stop_id).push(r.error_seconds)
}

const perStop = [...grouped.entries()]
  .map(([stopId, errs]) => ({
    stop_id: stopId,
    stop_name: stopName.get(stopId) ?? `stop_${stopId}`,
    n: errs.length,
    mae: mean(errs.map(Math.abs)),
    rmse: Math.sqrt(mean(errs.map((e) => e * e))),
    bias: mean(errs),
  }))
  .sort((a, b) => b.mae - a.mae)

console.log(`║`)
console.log(`║  ── Per halte (MAE terburuk di atas) ──`)
for (const s of perStop) {
  const nama = s.stop_name.padEnd(26).slice(0, 26)
  console.log(
    `║  ${nama} n=${String(s.n).padStart(3)}  MAE=${String(round1(s.mae)).padStart(6)}s` +
      `  RMSE=${String(round1(s.rmse)).padStart(6)}s  bias=${String(round1(s.bias)).padStart(7)}s`
  )
}

// ─── Ekspor CSV (bahan tabel & grafik laporan) ──────────────────────────────
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
const csv = [
  'id,trip_id,stop_id,stop_name,source,predicted_at,predicted_arrival,actual_arrival,predicted_travel_sec,actual_travel_sec,error_sec',
  ...rows.map((r) => {
    const t0 = new Date(r.predicted_at).getTime()
    const pt = Math.round((new Date(r.predicted_arrival).getTime() - t0) / 1000)
    const at = Math.round((new Date(r.actual_arrival).getTime() - t0) / 1000)
    return [
      r.id,
      r.trip_id,
      r.stop_id,
      esc(stopName.get(r.stop_id) ?? ''),
      r.source,
      new Date(r.predicted_at).toISOString(),
      new Date(r.predicted_arrival).toISOString(),
      new Date(r.actual_arrival).toISOString(),
      pt,
      at,
      r.error_seconds,
    ].join(',')
  }),
].join('\n')

writeFileSync(CSV_PATH, csv, 'utf8')
console.log(`║`)
console.log(`║  CSV data mentah → ${CSV_PATH} (${rows.length} baris)`)

if (SOURCE === 'simulated') {
  console.log(`║`)
  console.log(`║  PERINGATAN: ini data SIMULATOR, bukan bukti akurasi.`)
  console.log(`║      dummy-bus menyusuri polyline yang sama dengan yang dipakai`)
  console.log(`║      menghitung ETA, dan menuliskan sendiri kolom speed-nya —`)
  console.log(`║      jadi ia dinilai terhadap dirinya sendiri. JANGAN ditulis di`)
  console.log(`║      laporan sebagai akurasi sistem. Pakai --source=field.`)
}
console.log(`╚═\n`)

await prisma.$disconnect()
