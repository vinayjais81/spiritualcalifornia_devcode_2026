import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
export declare class AiService {
    private readonly prisma;
    private readonly config;
    private readonly client;
    private readonly model;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService);
    private readonly SYSTEM_PROMPT;
    chat(message: string, conversationHistory?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>): Promise<{
        reply: string;
        usage: {
            inputTokens: number;
            outputTokens: number;
        };
    } | {
        reply: string;
        usage: null;
    }>;
    productFinder(query: string): Promise<{
        reply: string;
        products: {
            id: string;
            name: string;
            price: number;
            type: import(".prisma/client").$Enums.ProductType;
        }[];
    }>;
    practitionerMatcher(query: string): Promise<{
        reply: string;
        practitioners: {
            id: string;
            slug: string;
            displayName: string;
            rating: number;
        }[];
    }>;
}
