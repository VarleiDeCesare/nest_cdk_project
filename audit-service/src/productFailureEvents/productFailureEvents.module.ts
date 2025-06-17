import { Module } from "@nestjs/common";
import { ProductFailureEventsConsumer } from "./productFailureEvents.consumer";
import { ProductFailureEventsService } from "./productFailureEvents.service";

@Module({
    providers: [
        ProductFailureEventsConsumer,
        ProductFailureEventsService
    ]
})
export class ProductFailureEventsModule {}