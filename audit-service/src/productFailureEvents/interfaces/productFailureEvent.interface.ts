export interface ProductFailureEventKey {
    pk: string;
    sk: string;
}

export interface ProductFailureEvent extends ProductFailureEventKey {
    info: {
        id?: string;
        status: number;
        error: string;
        requestId: string;
        messageId: string;
        traceId: string;
    };
    createdAt: number;
    ttl: number;
}