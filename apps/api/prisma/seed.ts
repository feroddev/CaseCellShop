import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const products = [
    {
      id: 'case-iphone-15',
      name: 'Case iPhone 15 (Silicone)',
      priceCents: 7990,
      stock: 5,
    },
    {
      id: 'case-galaxy-s24',
      name: 'Case Galaxy S24 (Matte)',
      priceCents: 6990,
      stock: 3,
    },
    {
      id: 'case-pixel-9',
      name: 'Case Pixel 9 (Clear)',
      priceCents: 7490,
      stock: 2,
    },
    {
      id: 'case-iphone-15-pro-rugged',
      name: 'Case iPhone 15 Pro (Rugged)',
      priceCents: 11990,
      stock: 1,
    },
    {
      id: 'case-iphone-14-clear',
      name: 'Case iPhone 14 (Clear)',
      priceCents: 5990,
      stock: 8,
    },
    {
      id: 'case-iphone-13-leather',
      name: 'Case iPhone 13 (Leather)',
      priceCents: 9990,
      stock: 0,
    },
    {
      id: 'case-galaxy-a55-slim',
      name: 'Case Galaxy A55 (Slim)',
      priceCents: 4990,
      stock: 12,
    },
    {
      id: 'case-galaxy-s23-ultra-rugged',
      name: 'Case Galaxy S23 Ultra (Rugged)',
      priceCents: 10990,
      stock: 2,
    },
    {
      id: 'case-moto-g84-matte',
      name: 'Case Moto G84 (Matte)',
      priceCents: 3990,
      stock: 6,
    },
    {
      id: 'case-xiaomi-13t-clear',
      name: 'Case Xiaomi 13T (Clear)',
      priceCents: 4290,
      stock: 4,
    },
    {
      id: 'case-poco-x6-pro-slim',
      name: 'Case Poco X6 Pro (Slim)',
      priceCents: 3790,
      stock: 7,
    },
    {
      id: 'case-iphone-se-2022-silicone',
      name: 'Case iPhone SE 2022 (Silicone)',
      priceCents: 4590,
      stock: 9,
    },
    {
      id: 'case-pixel-8a-clear',
      name: 'Case Pixel 8a (Clear)',
      priceCents: 6290,
      stock: 3,
    },
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
