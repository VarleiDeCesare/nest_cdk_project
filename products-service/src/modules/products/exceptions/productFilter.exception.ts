import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { ProductException } from "./product.exception";
import { LoggerFactory } from "json-logger-service";
import { Response } from "express";
import { EventsPublisherService } from "src/modules/events/eventsPublisher.service";

@Catch(ProductException)
export class ProductExceptionFilter implements ExceptionFilter {
	constructor(
		private eventPublisher: EventsPublisherService
	) {}

	async catch(exception: ProductException, host: ArgumentsHost) {
		const logger = LoggerFactory.createLogger(ProductExceptionFilter.name);

		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = exception.getStatus();
		const requestId = request.headers["requestid"];
		const traceId = request.headers["x-amzn-trace-id"];
		const productId = exception.productId;

		const messageId = await this.eventPublisher.sendProductEventFailure({
			error: exception.message,
			status,
			id: productId
		}, requestId);

		logger.error({
			traceId,
			requestId,
			productId,
			messageId,	
		}, exception.message);

		response.status(status).json({
			statusCode: status,
			message: exception.message,
			requestId,
		});
	}
}