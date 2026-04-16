"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const payments_service_1 = require("./payments.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
let PaymentsController = class PaymentsController {
    paymentsService;
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    findOne(id) {
        return this.paymentsService.findOne(id);
    }
    refund(id, amount) {
        return this.paymentsService.refund(id, amount);
    }
    handleWebhook(req) {
        const signature = req.headers['stripe-signature'];
        const rawBody = req.rawBody;
        if (!rawBody || !signature) {
            return { received: false, error: 'Missing body or signature' };
        }
        return this.paymentsService.handleStripeWebhook(rawBody, signature);
    }
    connectOnboard(user) {
        return this.paymentsService.createConnectOnboarding(user.id);
    }
    connectStatus(user) {
        return this.paymentsService.getConnectStatus(user.id);
    }
    getEarnings(user) {
        return this.paymentsService.getGuideEarnings(user.id);
    }
    requestPayout(user, amount) {
        return this.paymentsService.requestPayout(user.id, amount);
    }
    getPayoutHistory(user) {
        return this.paymentsService.getGuidePayoutHistory(user.id);
    }
    createIntent(data) {
        return this.paymentsService.createPaymentIntent(data);
    }
    confirmPayment(data) {
        return this.paymentsService.confirmPayment(data.paymentIntentId);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get payment details' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/refund'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Refund a payment (full or partial)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "refund", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('webhook/stripe'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Stripe webhook endpoint (raw body required)' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Post)('connect/onboard'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Start or resume Stripe Connect onboarding for guide' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "connectOnboard", null);
__decorate([
    (0, common_1.Get)('connect/status'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Get Stripe Connect account status' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "connectStatus", null);
__decorate([
    (0, common_1.Get)('earnings'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: "Get guide's earnings summary and recent payments" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getEarnings", null);
__decorate([
    (0, common_1.Post)('payout'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Request a payout (guide cashout)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)('amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "requestPayout", null);
__decorate([
    (0, common_1.Get)('payout-history'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: "Get guide's payout request history" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getPayoutHistory", null);
__decorate([
    (0, common_1.Post)('create-intent'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a payment intent and return client secret for Stripe Elements' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "createIntent", null);
__decorate([
    (0, common_1.Post)('confirm-payment'),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm payment after successful Stripe charge (fallback for webhook)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "confirmPayment", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('Payments'),
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map