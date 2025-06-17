import { Module } from "@nestjs/common";
import { ProductEventsConsumer } from "./productEvents.consumer";
import { ProductEventsService } from "./productEvents.service";

@Module({
    providers: [
        ProductEventsConsumer,
        ProductEventsService
    ]
})
export class ProductEventsModule {}