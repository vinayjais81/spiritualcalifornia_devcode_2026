"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizePipe = void 0;
const common_1 = require("@nestjs/common");
let SanitizePipe = class SanitizePipe {
    transform(value, metadata) {
        if (metadata.type === 'body' && typeof value === 'object' && value !== null) {
            return this.sanitizeObject(value);
        }
        if (typeof value === 'string') {
            return this.sanitizeString(value);
        }
        return value;
    }
    sanitizeObject(obj) {
        const sanitized = {};
        for (const [key, val] of Object.entries(obj)) {
            if (typeof val === 'string') {
                sanitized[key] = this.sanitizeString(val);
            }
            else if (Array.isArray(val)) {
                sanitized[key] = val.map(item => typeof item === 'string' ? this.sanitizeString(item) :
                    typeof item === 'object' && item !== null ? this.sanitizeObject(item) : item);
            }
            else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
                sanitized[key] = this.sanitizeObject(val);
            }
            else {
                sanitized[key] = val;
            }
        }
        return sanitized;
    }
    sanitizeString(str) {
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]*on\w+\s*=/gi, '<')
            .replace(/javascript:/gi, '')
            .trim();
    }
};
exports.SanitizePipe = SanitizePipe;
exports.SanitizePipe = SanitizePipe = __decorate([
    (0, common_1.Injectable)()
], SanitizePipe);
//# sourceMappingURL=sanitize.pipe.js.map