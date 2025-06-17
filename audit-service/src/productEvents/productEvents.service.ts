import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Injectable } from "@nestjs/common";
import { captureAWSv3Client } from "aws-xray-sdk";
import { ProductEventDto } from "./dto/productEvent.dto";
import { ProductEvent } from "./interfaces/productEvent.interface";
import { ProductEventType } from "./dto/productEventType.enum";

@Injectable()
export class ProductEventsService {
    private tableName: string
    private ddbDocClient: DynamoDBDocumentClient

    constructor() {
        this.tableName = process.env.EVENTS_DDB
        const ddbClient = captureAWSv3Client(new DynamoDBClient())
        this.ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
    }

    createProductEvent(productEventDto: ProductEventDto, 
        eventType: ProductEventType, messageId: string, requestId: string,
        traceId: string
    ) {
        const timestamp = Date.now()
        const ttl = ~~(timestamp / 1000 + 5 * 60) //5 minutos pra frente no tempo

        const productEvent: ProductEvent = {
            pk: `#product_${eventType}`,
            sk: `${timestamp}`,
            createdAt: timestamp,
            ttl: ttl,
            info: {
                id: productEventDto.id,
                code: productEventDto.code,
                price: productEventDto.price,
                messageId: messageId,
                requestId: requestId,
                traceId: traceId
            }
        }

        const command = new PutCommand({
            TableName: this.tableName,
            Item: productEvent
        })
        return this.ddbDocClient.send(command)
    }
}