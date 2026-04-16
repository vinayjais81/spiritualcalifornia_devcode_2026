import { ContactService } from './contact.service';
declare class SubmitContactDto {
    name: string;
    email: string;
    phone?: string;
    type: string;
    subject: string;
    message: string;
}
export declare class ContactController {
    private readonly contactService;
    constructor(contactService: ContactService);
    submit(dto: SubmitContactDto): Promise<{
        success: boolean;
        id: string;
    }>;
    getLeads(page?: string, limit?: string, status?: string, type?: string): Promise<{
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
    updateStatus(id: string, body: {
        status: string;
    }): Promise<{
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
}
export {};
