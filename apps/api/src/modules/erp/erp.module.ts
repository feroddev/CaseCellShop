import { Module } from '@nestjs/common';
import { ErpClient } from './erp.client';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [ErpClient],
  exports: [ErpClient],
})
export class ErpModule {}
