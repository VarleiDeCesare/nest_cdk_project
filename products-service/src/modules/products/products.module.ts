import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { EventsPublisherService } from "../events/eventsPublisher.service";

@Module({
	controllers: [ProductsController],
	providers: [
		ProductsService,
		EventsPublisherService,
	],
})
export class ProductsModule {}