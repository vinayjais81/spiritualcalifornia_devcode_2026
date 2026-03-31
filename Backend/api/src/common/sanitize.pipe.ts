import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Global pipe that sanitizes string inputs to prevent XSS.
 * Applied globally in main.ts — strips HTML tags and trims whitespace.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value);
    }
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    return value;
  }

  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        sanitized[key] = this.sanitizeString(val);
      } else if (Array.isArray(val)) {
        sanitized[key] = val.map(item =>
          typeof item === 'string' ? this.sanitizeString(item) :
          typeof item === 'object' && item !== null ? this.sanitizeObject(item) : item
        );
      } else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        sanitized[key] = this.sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  private sanitizeString(str: string): string {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*on\w+\s*=/gi, '<') // Remove event handlers
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .trim();
  }
}
