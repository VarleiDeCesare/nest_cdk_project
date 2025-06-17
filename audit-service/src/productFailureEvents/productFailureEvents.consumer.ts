import { Injectable } from "@nestjs/common"
import { JsonLogger, LoggerFactory } from "json-logger-service"
import { Consumer } from "sqs-consumer"
import { Message } from '@aws-sdk/client-sqs'
import { SNSMessage } from "aws-lambda";
import { ProductFailureEventType } from "./dto/productFailureEventsType.enum";
import { ProductFailureEventDto } from "./dto/productFailureEvent.dto";
import { ProductFailureEventsService } from "./productFailureEvents.service";
import { getNamespace, Segment, setSegment } from "aws-xray-sdk";

@Injectable()
export class ProductFailureEventsConsumer {
    private consumer: Consumer
    private readonly logger: JsonLogger = 
        LoggerFactory.createLogger(ProductFailureEventsConsumer.name)

    constructor(
        private productFailureEventsService: ProductFailureEventsService
    ) {
        this.consumer = Consumer.create({
            queueUrl: process.env.AWS_SQS_QUEUE_PRODUCT_FAILURE_EVENTS_URL,
            waitTimeSeconds: 10,
            pollingWaitTimeMs: 0,
            handleMessage: async (message) => this.handleMessage(message)
        })

        this.logger.info('Starting AWS SQS product failure events consumer')
        this.consumer.start()
    }

    async handleMessage(message: Message): Promise<void> {
        const body = JSON.parse(message.Body) as SNSMessage

        const eventType = body.MessageAttributes['eventType'].Value
        const traceId = body.MessageAttributes['traceId'].Value
        const requestId = body.MessageAttributes['requestId'].Value
        const messageId = body.MessageId

        const startTime = new Date().getTime() / 1000

        const segment = new Segment(process.env.AWS_XRAY_TRACING_NAME, traceId)
        segment.origin = "AWS::ECS:Container"
        segment.start_time = startTime
        segment.trace_id = traceId
        segment.addPluginData({
            operation: "HandleProductFailureEvent",
            region: process.env.AWS_REGION,
            queue_url: process.env.AWS_SQS_QUEUE_PRODUCT_FAILURE_EVENTS_URL
        })

        const ns = getNamespace()
        ns.run(async () => {
            setSegment(segment)

            if (eventType == ProductFailureEventType.PRODUCT_FAILURE) {
                const productFailureEvent = JSON.parse(body.Message) as ProductFailureEventDto
                
                await this.productFailureEventsService.createProductFailureEvent(
                    productFailureEvent, eventType,
                    messageId, requestId, traceId
                )
                
                this.logger.info(
                    {
                        requestId: requestId,
                        traceId: traceId,
                        messageId: messageId,
                        productId: productFailureEvent.id        
                    },
                    `Product failure event received: ${eventType}`
                )            
            } else {
                this.logger.error(
                    {
                        requestId: requestId,
                        traceId: traceId,
                        messageId: messageId,
                    },
                    `Invalid product event type: ${eventType}`
                )
                throw Error(`Invalid product event type: ${eventType}`)
            }
    
            segment.close()
        })
    }
}