"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoulToursModule = void 0;
const common_1 = require("@nestjs/common");
const soul_tours_controller_1 = require("./soul-tours.controller");
const soul_tours_service_1 = require("./soul-tours.service");
const tour_tasks_queue_1 = require("./tour-tasks.queue");
const payments_module_1 = require("../payments/payments.module");
const notifications_module_1 = require("../notifications/notifications.module");
let SoulToursModule = class SoulToursModule {
};
exports.SoulToursModule = SoulToursModule;
exports.SoulToursModule = SoulToursModule = __decorate([
    (0, common_1.Module)({
        imports: [payments_module_1.PaymentsModule, notifications_module_1.NotificationsModule],
        controllers: [soul_tours_controller_1.SoulToursController],
        providers: [soul_tours_service_1.SoulToursService, tour_tasks_queue_1.TourTasksQueue],
        exports: [soul_tours_service_1.SoulToursService],
    })
], SoulToursModule);
//# sourceMappingURL=soul-tours.module.js.map