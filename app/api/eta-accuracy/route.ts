import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/eta-accuracy — Ringkasan akurasi prediksi ETA (evaluasi).
//
// Membaca tabel eta_logs (diisi oleh eta-logger via mqtt-bridge / dummy-bus):
// setiap baris = satu prediksi kedatangan ke sebuah halte, plus kedatangan
// aktualnya. error_seconds = actual - predicted (+ telat, - lebih cepat).
//
// Query opsional: ?limit=N (jumlah baris terbaru yang dikembalikan, default 50).

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 500)

    // Prediksi yang sudah terisi kedatangan aktualnya (siap dievaluasi).
    const completed = await prisma.eta_logs.findMany({
      where: { actual_arrival: { not: null }, error_seconds: { not: null } },
      orderBy: { actual_arrival: 'desc' },
      take: limit,
    })

    const pendingCount = await prisma.eta_logs.count({
      where: { actual_arrival: null },
    })

    // Statistik ringkas dari error_seconds.
    const errors = completed
      .map((r) => r.error_seconds)
      .filter((e): e is number => e != null)

    const n = errors.length
    const absErrors = errors.map((e) => Math.abs(e))
    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

    const summary = {
      completed_count: n,
      pending_count: pendingCount,
      mean_error_seconds: Math.round(mean(errors)),
      mean_abs_error_seconds: Math.round(mean(absErrors)),
      max_abs_error_seconds: absErrors.length ? Math.max(...absErrors) : 0,
      // Persentase prediksi yang meleset ≤ 60 detik & ≤ 120 detik.
      within_60s_pct: n ? Math.round((absErrors.filter((e) => e <= 60).length / n) * 100) : 0,
      within_120s_pct: n ? Math.round((absErrors.filter((e) => e <= 120).length / n) * 100) : 0,
    }

    // Ambil nama halte untuk baris yang dikembalikan.
    const stopIds = [...new Set(completed.map((r) => r.stop_id))]
    const stops = await prisma.stops.findMany({ where: { id: { in: stopIds } } })
    const stopName = new Map(stops.map((s) => [s.id, s.name]))

    const recent = completed.map((r) => ({
      id: r.id,
      trip_id: r.trip_id,
      stop_id: r.stop_id,
      stop_name: stopName.get(r.stop_id) ?? `stop_${r.stop_id}`,
      predicted_arrival: r.predicted_arrival,
      actual_arrival: r.actual_arrival,
      error_seconds: r.error_seconds,
    }))

    return NextResponse.json({ summary, recent })
  } catch (error) {
    console.error('ETA accuracy API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
