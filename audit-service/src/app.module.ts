import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ProductEventsModule } from './productEvents/productEvents.module';
import { ProductFailureEventsModule } from './productFailureEvents/productFailureEvents.module';

@Module({
  imports: [
    HealthModule,
    ProductEventsModule,
    ProductFailureEventsModule
  ],
})
export class AppModule {}
