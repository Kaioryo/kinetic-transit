import { NextResponse } from 'next/server'
import { clearAdminSession, startAdminSession } from '@/lib/admin-session'

export async function POST(req: Request) {
  const { password } = await req.json()
  const adminPassword = process.env.ADMIN_PASSWORD

  // Fail-closed: tanpa ADMIN_PASSWORD yang diset, jangan pakai password default yang
  // bisa ditebak — tolak login. (Sebelumnya ada fallback hardcoded; dihapus demi keamanan
  // saat deploy publik.)
  if (!adminPassword) {
    return NextResponse.json(
      { success: false, message: 'Server belum dikonfigurasi (ADMIN_PASSWORD belum diset).' },
      { status: 500 }
    )
  }

  if (password !== adminPassword) {
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
