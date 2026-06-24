const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Ambil semua route unik
  const routes = await prisma.routes.findMany();
  
  for (const route of routes) {
    // Ambil semua route_stops untuk route ini, urutkan berdasarkan stop_order saat ini
    const routeStops = await prisma.route_stops.findMany({
      where: { route_id: route.id },
      orderBy: { stop_order: 'asc' }
    });
    
    // Normalisasi urutan mulai dari 1
    let expectedOrder = 1;
    for (const rs of routeStops) {
      if (rs.stop_order !== expectedOrder) {
        await prisma.route_stops.update({
          where: { id: rs.id },
          data: { stop_order: expectedOrder }
        });
        console.log(`Route ${route.id}: Fixed stop_id ${rs.stop_id} from ${rs.stop_order} to ${expectedOrder}`);
      }
      expectedOrder++;
    }
  }
  console.log("Database urutan halte berhasil dinormalisasi!");
}

main().finally(() => prisma.$disconnect());
