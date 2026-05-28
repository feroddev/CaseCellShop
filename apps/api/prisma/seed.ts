import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const products = [
    {
      id: 'case-iphone-15',
      name: 'Case iPhone 15',
      priceCents: 7990,
      stock: 5,
    },
    {
      id: 'case-galaxy-s24',
      name: 'Case Galaxy S24',
      priceCents: 6990,
      stock: 3,
    },
    { id: 'case-pixel-9', name: 'Case Pixel 9', priceCents: 7490, stock: 2 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, priceCents: p.priceCents },
      create: { id: p.id, name: p.name, priceCents: p.priceCents },
    });

    await prisma.inventoryItem.upsert({
      where: { productId: p.id },
      update: { available: p.stock },
      create: { productId: p.id, available: p.stock },
    });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
