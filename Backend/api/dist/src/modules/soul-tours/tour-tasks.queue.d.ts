import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SoulToursService } from './soul-tours.service';
export declare class TourTasksQueue implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly prisma;
    private readonly notifications;
    private readonly soulTours;
    private readonly logger;
    private queue;
    private worker;
    private readonly redisHost;
    private readonly redisPort;
    private readonly redisPassword;
    private readonly enabled;
    constructor(config: ConfigService, prisma: PrismaService, notifications: NotificationsService, soulTours: SoulToursService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private runHoldReaper;
    private runBalanceReminders;
    private runDepartureReminders;
}
