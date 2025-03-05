import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [HealthModule, ProductsModule],
})
export class AppModule {}
