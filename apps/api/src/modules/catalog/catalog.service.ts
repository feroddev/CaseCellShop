import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts() {
    const products = await this.prisma.product.findMany({
      orderBy: { id: 'asc' },
      include: { inventory: true },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      available: p.inventory?.available ?? 0,
    }));
  }

  async getProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { inventory: true },
    });

    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      available: product.inventory?.available ?? 0,
    };
  }
}
