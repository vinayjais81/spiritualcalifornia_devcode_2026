# Spiritual California Marketplace — ER Diagram

```mermaid
erDiagram

    %% ════════════════════════════════════════
    %% USER & AUTH
    %% ════════════════════════════════════════

    User {
        string id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        string avatarUrl
        string phone
        boolean isEmailVerified
        boolean isActive
        boolean isBanned
        string bannedReason
        string googleId UK
        string emailVerifyToken
        datetime emailVerifyExpiry
        string passwordResetToken
        datetime passwordResetExpiry
        datetime lastLoginAt
        boolean marketingEmails
        datetime createdAt
        datetime updatedAt
    }

    UserRole {
        string id PK
        string userId FK
        enum role
        datetime createdAt
    }

    RefreshToken {
        string id PK
        string userId FK
        string token UK
        datetime expiresAt
        boolean isRevoked
        datetime createdAt
    }

    User ||--o{ UserRole : "has roles"
    User ||--o{ RefreshToken : "has tokens"

    %% ════════════════════════════════════════
    %% PROFILES
    %% ════════════════════════════════════════

    SeekerProfile {
        string id PK
        string userId FK-UK
        string bio
        string location
        string timezone
        string[] interests
        int onboardingStep
        boolean onboardingCompleted
        datetime createdAt
        datetime updatedAt
    }

    GuideProfile {
        string id PK
        string userId FK-UK
        string slug UK
        string displayName
        string tagline
        string bio
        string location
        string studioName
        string streetAddress
        string city
        string state
        string zipCode
        string country
        string timezone
        string websiteUrl
        string instagramUrl
        string youtubeUrl
        string[] languages
        string[] modalities
        string[] issuesHelped
        int yearsExperience
        string calendarType
        string calendarLink
        string sessionPricingJson
        boolean calendlyConnected
        boolean isPublished
        boolean isVerified
        enum verificationStatus
        enum onboardingPath
        string stripeAccountId
        boolean stripeOnboardingDone
        string algoliaObjectId
        float averageRating
        int totalReviews
        string claimToken UK
        datetime claimTokenExpiry
        string scrapedSourceUrl
        datetime createdAt
        datetime updatedAt
    }

    GuideMedia {
        string id PK
        string guideId FK
        string type
        string url
        string thumbnailUrl
        string caption
        int sortOrder
        datetime createdAt
    }

    User ||--o| SeekerProfile : "has seeker profile"
    User ||--o| GuideProfile : "has guide profile"
    GuideProfile ||--o{ GuideMedia : "has media"

    %% ════════════════════════════════════════
    %% CATEGORIES
    %% ════════════════════════════════════════

    Category {
        string id PK
        string name UK
        string slug UK
        string description
        string iconUrl
        int sortOrder
        boolean isActive
        datetime createdAt
    }

    Subcategory {
        string id PK
        string categoryId FK
        string name
        string slug
        boolean isApproved
        boolean isCustom
        datetime createdAt
    }

    GuideCategory {
        string id PK
        string guideId FK
        string categoryId FK
        string subcategoryId FK
    }

    Category ||--o{ Subcategory : "has subcategories"
    Category ||--o{ GuideCategory : "tagged by guides"
    Subcategory ||--o{ GuideCategory : "tagged by guides"
    GuideProfile ||--o{ GuideCategory : "has categories"

    %% ════════════════════════════════════════
    %% CREDENTIALS & VERIFICATION
    %% ════════════════════════════════════════

    Credential {
        string id PK
        string guideId FK
        string title
        string institution
        int issuedYear
        string documentUrl
        enum verificationStatus
        float confidenceScore
        json extractedData
        string adminNotes
        datetime verifiedAt
        datetime createdAt
        datetime updatedAt
    }

    CredentialVerification {
        string id PK
        string credentialId FK
        string stage
        string status
        json result
        datetime processedAt
    }

    PersonaVerification {
        string id PK
        string userId UK
        string inquiryId UK
        string status
        string referenceId
        datetime completedAt
        datetime createdAt
        datetime updatedAt
    }

    InstitutionReference {
        string id PK
        string name
        string[] aliases
        string country
        string type
        boolean isActive
        datetime createdAt
    }

    GuideProfile ||--o{ Credential : "has credentials"
    Credential ||--o{ CredentialVerification : "verification log"

    %% ════════════════════════════════════════
    %% SERVICES & AVAILABILITY
    %% ════════════════════════════════════════

    Service {
        string id PK
        string guideId FK
        string name
        string description
        enum type
        decimal price
        string currency
        int durationMin
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Availability {
        string id PK
        string guideId FK
        int dayOfWeek
        string startTime
        string endTime
        boolean isRecurring
        int bufferMin
        datetime createdAt
    }

    ServiceSlot {
        string id PK
        string serviceId FK
        datetime startTime
        datetime endTime
        boolean isBooked
        boolean isBlocked
        datetime createdAt
    }

    GuideProfile ||--o{ Service : "offers services"
    GuideProfile ||--o{ Availability : "sets availability"
    Service ||--o{ ServiceSlot : "has slots"

    %% ════════════════════════════════════════
    %% BOOKINGS
    %% ════════════════════════════════════════

    Booking {
        string id PK
        string seekerId FK
        string serviceId FK
        string slotId FK-UK
        enum status
        decimal totalAmount
        string currency
        string notes
        datetime cancelledAt
        string cancelledBy
        string cancellationReason
        datetime completedAt
        datetime createdAt
        datetime updatedAt
    }

    SeekerProfile ||--o{ Booking : "makes bookings"
    Service ||--o{ Booking : "booked for"
    ServiceSlot ||--o| Booking : "assigned slot"

    %% ════════════════════════════════════════
    %% PAYMENTS & PAYOUTS
    %% ════════════════════════════════════════

    Payment {
        string id PK
        string bookingId FK-UK
        string orderId FK-UK
        string ticketPurchaseId FK-UK
        string tourBookingId FK
        string stripePaymentIntentId UK
        string stripeCheckoutSessionId
        string stripeTransferId
        decimal amount
        string currency
        decimal platformFee
        decimal guideAmount
        enum paymentType
        enum status
        decimal refundedAmount
        string stripeRefundId
        string paymentMethod
        json metadata
        datetime createdAt
        datetime updatedAt
    }

    PayoutAccount {
        string id PK
        string guideId FK-UK
        string stripeAccountId UK
        decimal availableBalance
        decimal pendingBalance
        decimal totalEarned
        decimal totalPaidOut
        string currency
        datetime createdAt
        datetime updatedAt
    }

    PayoutRequest {
        string id PK
        string guideId FK
        string payoutAccountId FK
        decimal amount
        string currency
        enum status
        string stripePayoutId
        datetime processedAt
        datetime createdAt
    }

    Booking ||--o| Payment : "has payment"
    GuideProfile ||--o| PayoutAccount : "has payout account"
    GuideProfile ||--o{ PayoutRequest : "requests payouts"
    PayoutAccount ||--o{ PayoutRequest : "pays out from"

    %% ════════════════════════════════════════
    %% EVENTS & TICKETS
    %% ════════════════════════════════════════

    Event {
        string id PK
        string guideId FK
        string title
        string description
        enum type
        datetime startTime
        datetime endTime
        string timezone
        string location
        string onlineUrl
        string zoomMeetingId
        string zoomJoinUrl
        string coverImageUrl
        boolean isPublished
        boolean isCancelled
        string algoliaObjectId
        datetime createdAt
        datetime updatedAt
    }

    EventTicketTier {
        string id PK
        string eventId FK
        string name
        string description
        decimal price
        string currency
        int capacity
        int sold
        boolean isActive
        datetime createdAt
    }

    TicketPurchase {
        string id PK
        string seekerId FK
        string tierId FK
        int quantity
        decimal totalAmount
        string qrCode UK
        string attendeeName
        string attendeeEmail
        string dietaryNeeds
        string accessibilityNeeds
        datetime createdAt
    }

    GuideProfile ||--o{ Event : "hosts events"
    Event ||--o{ EventTicketTier : "has ticket tiers"
    EventTicketTier ||--o{ TicketPurchase : "purchased as"
    SeekerProfile ||--o{ TicketPurchase : "buys tickets"
    TicketPurchase ||--o| Payment : "has payment"

    %% ════════════════════════════════════════
    %% PRODUCTS & ORDERS
    %% ════════════════════════════════════════

    Product {
        string id PK
        string guideId FK
        string name
        string description
        enum type
        decimal price
        string currency
        int stockQuantity
        string[] imageUrls
        string fileS3Key
        json digitalFiles
        json shippingInfo
        boolean isActive
        string algoliaObjectId
        datetime createdAt
        datetime updatedAt
    }

    ProductVariant {
        string id PK
        string productId FK
        string name
        string sku UK
        decimal price
        int stockQuantity
        json attributes
        int sortOrder
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Order {
        string id PK
        string seekerId FK
        enum status
        decimal subtotal
        decimal discountAmount
        decimal shippingCost
        decimal taxAmount
        decimal taxRate
        decimal totalAmount
        string currency
        json shippingAddress
        string contactEmail
        string contactFirstName
        string contactLastName
        string contactPhone
        string promoCodeId FK
        string shippingMethodId FK
        string notes
        datetime createdAt
        datetime updatedAt
    }

    OrderItem {
        string id PK
        string orderId FK
        string productId FK
        string variantId
        int quantity
        decimal unitPrice
        string downloadUrl
        int downloadCount
        datetime createdAt
    }

    GuideProfile ||--o{ Product : "sells products"
    Product ||--o{ ProductVariant : "has variants"
    Product ||--o{ OrderItem : "ordered as"
    SeekerProfile ||--o{ Order : "places orders"
    Order ||--o{ OrderItem : "contains items"
    Order ||--o| Payment : "has payment"

    %% ════════════════════════════════════════
    %% BLOG
    %% ════════════════════════════════════════

    BlogPost {
        string id PK
        string guideId FK
        string title
        string slug
        string content
        string excerpt
        string coverImageUrl
        string[] tags
        boolean isPublished
        datetime publishedAt
        string algoliaObjectId
        datetime createdAt
        datetime updatedAt
    }

    GuideProfile ||--o{ BlogPost : "writes posts"

    %% ════════════════════════════════════════
    %% REVIEWS & TESTIMONIALS
    %% ════════════════════════════════════════

    Review {
        string id PK
        string authorId FK
        string targetId FK
        string bookingId FK-UK
        int rating
        string title
        string body
        boolean isApproved
        boolean isFlagged
        datetime createdAt
        datetime updatedAt
    }

    Testimonial {
        string id PK
        string authorId FK
        string targetGuideId
        string body
        boolean isApproved
        datetime createdAt
    }

    User ||--o{ Review : "writes reviews"
    User ||--o{ Review : "receives reviews"
    Booking ||--o| Review : "reviewed"
    User ||--o{ Testimonial : "writes testimonials"

    %% ════════════════════════════════════════
    %% FAVORITES
    %% ════════════════════════════════════════

    Favorite {
        string id PK
        string seekerId FK
        string guideId
        datetime createdAt
    }

    SeekerProfile ||--o{ Favorite : "favorites"

    %% ════════════════════════════════════════
    %% NOTIFICATIONS
    %% ════════════════════════════════════════

    Notification {
        string id PK
        string userId FK
        enum type
        string title
        string body
        json data
        boolean isRead
        datetime createdAt
    }

    User ||--o{ Notification : "receives"

    %% ════════════════════════════════════════
    %% PLATFORM & ADMIN
    %% ════════════════════════════════════════

    PlatformSetting {
        string id PK
        string key UK
        string value
        string type
        datetime updatedAt
    }

    AuditLog {
        string id PK
        string userId FK
        string action
        string entity
        string entityId
        json oldValue
        json newValue
        string ipAddress
        string userAgent
        datetime createdAt
    }

    User ||--o{ AuditLog : "performed"

    %% ════════════════════════════════════════
    %% SUBSCRIPTIONS
    %% ════════════════════════════════════════

    GuideSubscription {
        string id PK
        string guideId FK-UK
        string stripeSubscriptionId UK
        enum status
        datetime currentPeriodStart
        datetime currentPeriodEnd
        datetime cancelledAt
        datetime createdAt
        datetime updatedAt
    }

    GuideProfile ||--o| GuideSubscription : "has subscription"

    %% ════════════════════════════════════════
    %% SCRAPER
    %% ════════════════════════════════════════

    ScraperJob {
        string id PK
        string source
        string targetUrl
        string status
        json scrapedData
        string guideProfileId
        string errorMessage
        datetime startedAt
        datetime completedAt
        datetime createdAt
    }

    %% ════════════════════════════════════════
    %% CONTACT LEADS
    %% ════════════════════════════════════════

    ContactLead {
        string id PK
        string name
        string email
        string phone
        string type
        string subject
        string message
        string status
        datetime createdAt
        datetime updatedAt
    }

    %% ════════════════════════════════════════
    %% CART
    %% ════════════════════════════════════════

    Cart {
        string id PK
        string userId UK
        string sessionId UK
        datetime createdAt
        datetime updatedAt
    }

    CartItem {
        string id PK
        string cartId FK
        enum itemType
        string itemId
        string variantId
        int quantity
        json metadata
        datetime createdAt
        datetime updatedAt
    }

    Cart ||--o{ CartItem : "contains"

    %% ════════════════════════════════════════
    %% SOUL TOURS
    %% ════════════════════════════════════════

    SoulTour {
        string id PK
        string guideId FK
        string title
        string slug UK
        string description
        string shortDesc
        datetime startDate
        datetime endDate
        string timezone
        string location
        string address
        string city
        string state
        string country
        decimal basePrice
        string currency
        int capacity
        int spotsRemaining
        string coverImageUrl
        string[] imageUrls
        string[] highlights
        string[] included
        string[] notIncluded
        string requirements
        decimal depositMin
        boolean isPublished
        boolean isCancelled
        datetime createdAt
        datetime updatedAt
    }

    TourRoomType {
        string id PK
        string tourId FK
        string name
        string description
        decimal pricePerNight
        decimal totalPrice
        int capacity
        int available
        string[] amenities
        int sortOrder
        datetime createdAt
    }

    TourBooking {
        string id PK
        string tourId FK
        string seekerId FK
        string roomTypeId FK
        int travelers
        decimal totalAmount
        decimal depositAmount
        datetime depositPaidAt
        decimal balanceAmount
        datetime balancePaidAt
        string currency
        enum status
        string specialRequests
        string contactFirstName
        string contactLastName
        string contactEmail
        string contactPhone
        datetime cancelledAt
        string cancellationReason
        datetime createdAt
        datetime updatedAt
    }

    GuideProfile ||--o{ SoulTour : "organizes tours"
    SoulTour ||--o{ TourRoomType : "has room types"
    SoulTour ||--o{ TourBooking : "has bookings"
    SeekerProfile ||--o{ TourBooking : "books tours"
    TourRoomType ||--o{ TourBooking : "selected room"
    TourBooking ||--o{ Payment : "has payments"

    %% ════════════════════════════════════════
    %% PROMO CODES & SHIPPING/TAX
    %% ════════════════════════════════════════

    PromoCode {
        string id PK
        string code UK
        enum type
        decimal amount
        decimal minOrderAmount
        decimal maxDiscountAmount
        int maxUses
        int usedCount
        string appliesToType
        datetime startsAt
        datetime expiresAt
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    ShippingMethod {
        string id PK
        string name
        string description
        decimal price
        string currency
        int estimatedDaysMin
        int estimatedDaysMax
        boolean isActive
        int sortOrder
        datetime createdAt
        datetime updatedAt
    }

    TaxRate {
        string id PK
        string state
        string country
        decimal rate
        string name
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    PromoCode ||--o{ Order : "applied to"
    ShippingMethod ||--o{ Order : "ships via"
```

## Summary

| Domain | Tables | Key Relationships |
|--------|--------|-------------------|
| **User & Auth** | User, UserRole, RefreshToken | Multi-role RBAC, JWT refresh tokens |
| **Profiles** | SeekerProfile, GuideProfile, GuideMedia | 1:1 per User, Guide has rich profile |
| **Categories** | Category, Subcategory, GuideCategory | Many-to-many Guide ↔ Category (with optional subcategory) |
| **Verification** | Credential, CredentialVerification, PersonaVerification, InstitutionReference | Multi-stage pipeline: Textract → Claude NLP → Admin |
| **Services** | Service, Availability, ServiceSlot | Guide sets weekly availability, slots generated per service |
| **Bookings** | Booking | Seeker books a slot for a service |
| **Payments** | Payment, PayoutAccount, PayoutRequest | Polymorphic Payment (booking/order/ticket/tour), Stripe Connect payouts |
| **Events** | Event, EventTicketTier, TicketPurchase | Tiered ticket pricing, per-attendee details |
| **Products** | Product, ProductVariant, Order, OrderItem | Digital + Physical, variant support, order with tax/shipping/promo |
| **Blog** | BlogPost | Guide-authored, Algolia-indexed |
| **Reviews** | Review, Testimonial | Booking-linked reviews, standalone testimonials |
| **Social** | Favorite, Notification | Seeker favorites Guides, in-app notifications |
| **Platform** | PlatformSetting, AuditLog | Key-value config, full audit trail |
| **Subscriptions** | GuideSubscription | Future: $50/mo Guide subscription via Stripe |
| **Scraper** | ScraperJob | Proactive onboarding (deferred) |
| **Cart** | Cart, CartItem | Hybrid guest/user cart, polymorphic items |
| **Soul Tours** | SoulTour, TourRoomType, TourBooking | Multi-day retreats with room types, deposit/balance payments |
| **Commerce** | PromoCode, ShippingMethod, TaxRate | Discount codes, shipping options, state-level tax rates |

**Total: 38 models, 17 enums**
