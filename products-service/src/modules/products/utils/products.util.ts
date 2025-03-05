import { ProductDto } from "../dto/product.dto";
import { Product } from "../entities/product.entity";

export const productToProductDto = (product: Product): ProductDto  => {
	return {
		name: product.productName,
		code: product.code,
		id: product.id,
		model: product.model,
		price: product.price,
		url: product.productUrl
	};
}

export const productDtoToProduct = (productDto: ProductDto): Product => {
	return {
		productName: productDto.name,
		code: productDto.code,
		model: productDto.model,
		price: productDto.price,
		id: productDto.id,
		productUrl: productDto.url
	};
}