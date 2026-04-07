import { NotificationsService } from './notifications.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    findMine(user: CurrentUserData, page?: string, limit?: string): Promise<{
        notifications: {
            data: import("@prisma/client/runtime/client").JsonValue | null;
            id: string;
            type: import(".prisma/client").$Enums.NotificationType;
            title: string;
            body: string;
            isRead: boolean;
            createdAt: Date;
            userId: string;
        }[];
        unreadCount: number;
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    markAsRead(user: CurrentUserData, id: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    markAllAsRead(user: CurrentUserData): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
