import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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

  const cookieStore = await cookies()
  cookieStore.set('admin_session', 'authenticated', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production', // HTTPS-only di produksi
    maxAge: 60 * 60 * 8, // 8 jam
    path: '/',
  })

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  return NextResponse.json({ success: true })
}
