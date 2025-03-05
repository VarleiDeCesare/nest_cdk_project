import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { ProductDto } from "./dto/product.dto";
import { ProductsService } from "./products.service";
import { productDtoToProduct, productToProductDto } from "./utils/products.util";

@Controller('api/products')
export class ProductsController {
	constructor(
		private readonly service: ProductsService,
	) {

	}
	@Get()
	async getAll(): Promise<ProductDto[]> {
		const products = await this.service.findAll();
		return products.map(productToProductDto);
	}

	@Get(':id')
	async getOne(
		@Param('id') id: string,
	): Promise<ProductDto> {
		const product = await this.service.findOne({
			id,
		});
		return productToProductDto(product);
	}

	@Post()
	async create(
		@Body() productDto: ProductDto,
	): Promise<ProductDto> {
		const product = productDtoToProduct(productDto);
		const productCreated = await this.service.create(product);

		return {
			...productDto,
			id: productCreated.id,
		};
	}

	@Delete(':id')
	async delete(
		@Param('id') id: string,
	): Promise<void> {
		await this.service.delete({
			id,
		});
	}

	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() productDto: ProductDto,
	): Promise<ProductDto> {
		const product = productDtoToProduct(productDto);
		const productUpdated = await this.service.update({id}, product);
		return productToProductDto(productUpdated);
	}
	
}