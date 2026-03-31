"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const orders_controller_1 = require("./orders.controller");
const orders_service_1 = require("./orders.service");
const downloads_service_1 = require("./downloads.service");
const payments_module_1 = require("../payments/payments.module");
const checkout_module_1 = require("../checkout/checkout.module");
const upload_module_1 = require("../upload/upload.module");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [payments_module_1.PaymentsModule, checkout_module_1.CheckoutModule, upload_module_1.UploadModule],
        controllers: [orders_controller_1.OrdersController],
        providers: [orders_service_1.OrdersService, downloads_service_1.DownloadsService],
        exports: [orders_service_1.OrdersService, downloads_service_1.DownloadsService],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map