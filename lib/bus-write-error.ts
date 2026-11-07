import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

export function handleBusWriteError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = error.meta?.target
    if (target === 'license_plate' ||
        (Array.isArray(target) && target.length === 1 && target[0] === 'license_plate')) {
      return NextResponse.json({ error: 'Pelat nomor sudah terdaftar.' }, { status: 409 })
    }
  }

  throw error
}
