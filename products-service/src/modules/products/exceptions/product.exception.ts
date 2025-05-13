import { HttpException, HttpStatus } from "@nestjs/common";

export class ProductException extends HttpException {
	readonly productId?: string;

	constructor(message: string, statusCode: HttpStatus, productId?: string) {
		super(message, statusCode);
		this.productId = productId;
	}

	

}