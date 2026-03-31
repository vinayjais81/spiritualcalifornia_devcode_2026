"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrictThrottle = StrictThrottle;
exports.PaymentThrottle = PaymentThrottle;
exports.AIThrottle = AIThrottle;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
function StrictThrottle() {
    return (0, common_1.applyDecorators)((0, throttler_1.Throttle)({ short: { limit: 5, ttl: 60000 } }), (0, common_1.UseGuards)(throttler_1.ThrottlerGuard));
}
function PaymentThrottle() {
    return (0, common_1.applyDecorators)((0, throttler_1.Throttle)({ short: { limit: 10, ttl: 60000 } }), (0, common_1.UseGuards)(throttler_1.ThrottlerGuard));
}
function AIThrottle() {
    return (0, common_1.applyDecorators)((0, throttler_1.Throttle)({ short: { limit: 20, ttl: 60000 } }), (0, common_1.UseGuards)(throttler_1.ThrottlerGuard));
}
//# sourceMappingURL=throttle.decorator.js.map