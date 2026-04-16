import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GuidesModule } from './modules/guides/guides.module';
import { ServicesModule } from './modules/services/services.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EventsModule } from './modules/events/events.module';
import { ProductsModule } from './modules/products/products.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AdminModule } from './modules/admin/admin.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { UploadModule } from './modules/upload/upload.module';
import { SeekersModule } from './modules/seekers/seekers.module';
import { ContactModule } from './modules/contact/contact.module';
import { BlogModule } from './modules/blog/blog.module';
import { HomeModule } from './modules/home/home.module';
import { CartModule } from './modules/cart/cart.module';
import { SoulToursModule } from './modules/soul-tours/soul-tours.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { CalendlyModule } from './modules/calendly/calendly.module';
import { TicketsModule } from './modules/tickets/tickets.module';

@Module({
  imports: [
    // Config (global, validates env on startup)
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: '.env',
    }),

    // Rate limiting (global guard applied per module as needed)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),

    // Core infrastructure
    DatabaseModule,

    // Feature modules
    AuthModule,
    UsersModule,
    GuidesModule,
    ServicesModule,
    BookingsModule,
    PaymentsModule,
    EventsModule,
    ProductsModule,
    ReviewsModule,
    AdminModule,
    VerificationModule,
    AiModule,
    NotificationsModule,
    SearchModule,
    UploadModule,
    SeekersModule,
    ContactModule,
    BlogModule,
    HomeModule,
    CartModule,
    SoulToursModule,
    OrdersModule,
    CheckoutModule,
    CalendlyModule,
    TicketsModule,
  ],
})
export class AppModule {}
