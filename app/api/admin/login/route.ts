import { NextResponse } from 'next/server'
import { verifyAdminPassword } from '@/lib/admin-password.mjs'
import { clearAdminSession, startAdminSession } from '@/lib/admin-session'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const verified = await verifyAdminPassword(body?.password, process.env.ADMIN_PASSWORD_HASH)

  if (verified === null) {
    return NextResponse.json(
      { success: false, message: 'Kata sandi administrator belum dikonfigurasi.' },
      { status: 500 }
    )
  }

  if (!verified) {
    return NextResponse.json({ success: false, message: 'Password salah.' }, { status: 401 })
  }

  if (!(await startAdminSession())) {
    return NextResponse.json(
      { success: false, message: 'Sesi administrator belum dikonfigurasi.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  await clearAdminSession()
  return NextResponse.json({ success: true })
}
