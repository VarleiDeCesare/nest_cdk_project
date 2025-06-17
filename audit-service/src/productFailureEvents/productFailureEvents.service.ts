import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Injectable } from "@nestjs/common";
import { captureAWSv3Client } from "aws-xray-sdk";
import { ProductFailureEventDto } from "./dto/productFailureEvent.dto";
import { ProductFailureEventType } from "./dto/productFailureEventsType.enum";
import { ProductFailureEvent } from "./interfaces/productFailureEvent.interface";

@Injectable()
export class ProductFailureEventsService {
    private tableName: string
    private ddbDocClient: DynamoDBDocumentClient

    constructor() {
        this.tableName = process.env.EVENTS_DDB
        const ddbClient = captureAWSv3Client(new DynamoDBClient())
        this.ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
    }

    createProductFailureEvent(productFailureEventDto: ProductFailureEventDto,
        eventType: ProductFailureEventType, messageId: string, requestId: string,
        traceId: string
    ) {
        const timestamp = Date.now()
        const ttl = ~~(timestamp / 1000 + 5 * 60)

        const productFailureEvent: ProductFailureEvent = {
            pk: `#product_${eventType}`,
            sk: `${timestamp}`,
            createdAt: timestamp,
            ttl: ttl,
            info: {
                id: productFailureEventDto.id,
                error: productFailureEventDto.error,
                status: productFailureEventDto.status,
                messageId: messageId,
                requestId: requestId,
                traceId: traceId
            }
        }

        const command = new PutCommand({
            TableName: this.tableName,
            Item: productFailureEvent
        })
        return this.ddbDocClient.send(command)
    }
}