const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stops = await prisma.route_stops.findMany({
    where: { route_id: 1 },
    include: { stops: true },
    orderBy: { stop_order: 'asc' }
  });
  console.log(stops.map(s => `#${s.stop_order}: ${s.stops.name} (ID: ${s.stops.id})`).join('\n'));
}

main().finally(() => prisma.$disconnect());
