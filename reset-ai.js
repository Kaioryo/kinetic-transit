const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE stops AUTO_INCREMENT = 1;');
    console.log("Auto-increment stops berhasil di-reset!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main().finally(() => prisma.$disconnect());
