import { AiService } from './ai.service';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    chat(body: {
        message: string;
        history?: Array<{
            role: 'user' | 'assistant';
            content: string;
        }>;
    }): Promise<{
        reply: string;
        usage: {
            inputTokens: number;
            outputTokens: number;
        };
    } | {
        reply: string;
        usage: null;
    }>;
    productFinder(body: {
        query: string;
    }): Promise<{
        reply: string;
        products: {
            id: string;
            name: string;
            price: number;
            type: import(".prisma/client").$Enums.ProductType;
        }[];
    }>;
    practitionerMatch(body: {
        query: string;
    }): Promise<{
        reply: string;
        practitioners: {
            id: string;
            slug: string;
            displayName: string;
            rating: number;
        }[];
    }>;
}
