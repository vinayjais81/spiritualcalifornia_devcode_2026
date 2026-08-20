import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';

/**
 * Operational endpoints. Excluded from Swagger — they are infrastructure,
 * not API surface.
 *
 * Routes resolve under the global prefix and default version:
 *   GET /api/v1/health        deep readiness  (deploy gate, monitoring)
 *   GET /api/v1/health/live   liveness        (ALB target group)
 */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness — is this process up and serving?
   *
   * This is what the load balancer polls. It deliberately touches no
   * dependency: the question a target group asks is "should traffic go to
   * THIS instance", and a shared database being slow is not a reason to
   * prefer one instance over another.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /**
   * Readiness — can this process actually serve requests?
   *
   * 200 when every dependency answers, 503 otherwise, with per-component
   * detail so the failing dependency is named rather than guessed at.
   */
  @Get()
  async ready(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.check();
    res.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
