import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('/products')
  async listProducts() {
    return this.catalogService.listProducts();
  }

  @Get('/products/:id')
  async getProduct(@Param('id') productId: string) {
    const product = await this.catalogService.getProduct(productId);
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND' });
    return product;
  }
}
