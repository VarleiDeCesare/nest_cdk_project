import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { Injectable } from "@nestjs/common";
import { captureAWSv3Client } from "aws-xray-sdk";
import { EventType } from "./dto/eventType.enum";
import * as AWSXRay from "aws-xray-sdk-core";
import { Product } from "../products/entities/product.entity";
import { ProductEventDto } from "./dto/productEvent.dto";
import { ProductEventFailure } from "./dto/productEventFailure.dto";

@Injectable()
export class EventsPublisherService {
	private readonly snsClient: SNSClient;
	private readonly snsArn: string;
	constructor() {
		this.snsClient = captureAWSv3Client(new SNSClient());
		this.snsArn = process.env.AWS_SNS_TOPIC_PRODUCT_EVENTS_ARN;
	}

	public sendProductEvent(product: Product, eventType: EventType, requestId: string): Promise<string> {
		const productEvent: ProductEventDto = {
			id: product.id,
			code: product.code,
			price: product.price,
		};

		return this.sendEvent(JSON.stringify(productEvent), eventType, requestId);
	}

	private async sendEvent(data: string, eventType: EventType, requestId: string): Promise<string> {

		const segment = AWSXRay.getSegment() as AWSXRay.Segment;

		const command = new PublishCommand({
			Message: data,
			TopicArn: this.snsArn,
			MessageAttributes: {
				eventType: {
					DataType: "String",
					StringValue: eventType,
				},
				requestId: {
					DataType: "String",
					StringValue: requestId,
				},
				traceId: {
					DataType: "String",
					StringValue: segment.trace_id,
				}
			},
		});

		const result = await this.snsClient.send(command);

		return result.MessageId;
	}

	public sendProductEventFailure(productFailure: ProductEventFailure, requestId: string): Promise<string> {
		return this.sendEvent(JSON.stringify(productFailure), EventType.PRODUCT_FAILURE, requestId);
	}
}