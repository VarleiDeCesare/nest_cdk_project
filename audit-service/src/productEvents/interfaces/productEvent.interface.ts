export interface ProductEventKey {
    pk: string;
    sk: string;
}

export interface ProductEvent extends ProductEventKey {
    info: {
        id: string;
        code: string;
        price: number;
        messageId: string;
        requestId: string;
        traceId: string;
    },
    createdAt: number
    ttl: number;
}