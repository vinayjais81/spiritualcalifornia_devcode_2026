import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Public routes still *try* to attach the user if a valid JWT is present,
      // so endpoints like GET /cart (public for guest support) can differentiate
      // between "anonymous visitor" and "logged-in seeker" without forcing every
      // caller to adopt a separate OptionalAuth guard. Failures are swallowed —
      // guests pass through unchanged.
      try {
        await (super.canActivate(context) as Promise<boolean>);
      } catch { /* no token / bad token — treat as guest */ }
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }

  /**
   * Overridden so the Passport strategy doesn't throw on missing/invalid tokens
   * for public routes — `req.user` is populated only when a valid JWT is present.
   * Non-public routes still enforce auth via `super.canActivate` above.
   */
  handleRequest<TUser>(err: any, user: any, info: any, context: ExecutionContext): TUser {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return user ?? (null as any);
    return super.handleRequest(err, user, info, context);
  }
}
