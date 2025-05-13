import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from "@nestjs/common";
import { ProductDto } from "./dto/product.dto";
import { ProductsService } from "./products.service";
import { productDtoToProduct, productToProductDto } from "./utils/products.util";
import { JsonLogger, LoggerFactory } from "json-logger-service";
import { EventsPublisherService } from "../events/eventsPublisher.service";
import { EventType } from "../events/dto/eventType.enum";

@Controller('api/products')
export class ProductsController {
	private logger: JsonLogger = LoggerFactory.createLogger(ProductsController.name);
	constructor(
		private readonly service: ProductsService,
		private readonly eventsPublisher: EventsPublisherService,
	) {

	}
	@Get()
	async getAll(@Headers() headers, @Query('code') code?: string): Promise<ProductDto[] | ProductDto> {
		if (code) {
			this.logger.info({ requestId: headers['requestid'], traceId: headers['x-amzn-trace-id'], code }, "Get product by code");
			const product = await this.service.findByCode(code);
			return productToProductDto(product);
		} else {
			this.logger.info({ requestId: headers['requestid'], traceId: headers['x-amzn-trace-id'] }, "Get all products");
			const products = await this.service.findAll();
			return products.map(productToProductDto);
		}
	}

	@Get(':id')
	async getOne(
		@Param('id') id: string,
		@Headers() headers,
	): Promise<ProductDto> {
		this.logger.info({ requestId: headers['requestid'], traceId: headers['x-amzn-trace-id'], productId: id }, "Get product by id");
		const product = await this.service.findOne({
			id,
		});
		return productToProductDto(product);
	}

	@Post()
	async create(
		@Body() productDto: ProductDto,
		@Headers() headers,
	): Promise<ProductDto> {
		const requestId = headers['requestid'];
		const traceId = headers['x-amzn-trace-id'];

		this.logger.info({ requestId, traceId }, "Create new product");
		
		const product = productDtoToProduct(productDto);
		const productCreated = await this.service.create(product);

		const result = await this.eventsPublisher.sendProductEvent(productCreated, EventType.PRODUCT_CREATED, requestId);

		this.logger.info({ requestId, traceId, messageId: result, productId: productCreated.id }, "Proeudct creation event sent");

		return productToProductDto(productCreated);
	}

	@Delete(':id')
	async delete(
		@Param('id') id: string,
		@Headers() headers,
	): Promise<void> {
		const requestId = headers['requestid'];
		const traceId = headers['x-amzn-trace-id'];

		this.logger.info({ requestId, traceId, productId: id }, "Delete product by id");
		
		await this.service.delete({
			id,
		});
	}

	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() productDto: ProductDto,
		@Headers() headers,
	): Promise<ProductDto> {
		const requestId = headers['requestid'];
		const traceId = headers['x-amzn-trace-id'];

		this.logger.info({ requestId, traceId, productId: id }, "Update product by id");
		const product = productDtoToProduct(productDto);
		const productUpdated = await this.service.update({id}, product);

		const result = await this.eventsPublisher.sendProductEvent(productUpdated, EventType.PRODUCT_UPDATED, requestId);

		this.logger.info({ requestId, traceId, messageId: result, productId: productUpdated.id }, "Product update event sent");
		
		return productToProductDto(productUpdated);
	}
	
}