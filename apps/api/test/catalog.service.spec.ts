import { CatalogService } from '@/modules/catalog/catalog.service';

describe('CatalogService', () => {
  it('maps product list including inventory available', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            name: 'Case',
            priceCents: 1000,
            inventory: { available: 7 },
          },
          {
            id: 'p2',
            name: 'Charger',
            priceCents: 2500,
            inventory: null,
          },
        ]),
      },
    };

    const service = new CatalogService(prisma as any);
    const result = await service.listProducts();

    expect(result).toEqual([
      { id: 'p1', name: 'Case', priceCents: 1000, available: 7 },
      { id: 'p2', name: 'Charger', priceCents: 2500, available: 0 },
    ]);
  });

  it('returns null for unknown product', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new CatalogService(prisma as any);
    await expect(service.getProduct('missing')).resolves.toBeNull();
  });

  it('maps single product when found (with inventory)', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          name: 'Case',
          priceCents: 1000,
          inventory: { available: 3 },
        }),
      },
    };

    const service = new CatalogService(prisma as any);
    await expect(service.getProduct('p1')).resolves.toEqual({
      id: 'p1',
      name: 'Case',
      priceCents: 1000,
      available: 3,
    });
  });

  it('maps single product when found (without inventory)', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p2',
          name: 'Charger',
          priceCents: 2500,
          inventory: null,
        }),
      },
    };

    const service = new CatalogService(prisma as any);
    await expect(service.getProduct('p2')).resolves.toEqual({
      id: 'p2',
      name: 'Charger',
      priceCents: 2500,
      available: 0,
    });
  });
});
