import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
export interface SubmitContactDto {
    name: string;
    email: string;
    phone?: string;
    type: string;
    subject: string;
    message: string;
}
export declare class ContactService {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService);
    getLeads(params: {
        page: number;
        limit: number;
        status?: string;
        type?: string;
    }): Promise<{
        leads: {
            id: string;
            name: string;
            createdAt: Date;
            email: string;
            phone: string | null;
            updatedAt: Date;
            type: string;
            status: string;
            message: string;
            subject: string;
        }[];
        total: number;
        page: number;
        totalPages: number;
        statusCounts: {
            [k: string]: number;
        };
    }>;
    updateLeadStatus(id: string, status: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        email: string;
        phone: string | null;
        updatedAt: Date;
        type: string;
        status: string;
        message: string;
        subject: string;
    }>;
    submitLead(dto: SubmitContactDto): Promise<{
        success: boolean;
        id: string;
    }>;
    private sendEmails;
    private buildConfirmationEmail;
    private buildNotificationEmail;
}
