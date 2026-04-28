import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Role } from '@prisma/client';

export interface JwtRefreshPayload {
  sub: string;
  email: string;
  roles: Role[];
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refresh_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken = req?.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');
    // Map JWT `sub` claim → `id` so consumers (CurrentUser decorator,
    // controllers, services) can use `user.id` consistently with what
    // JwtStrategy returns. Without this mapping, /auth/refresh always
    // throws "Invalid refresh token" because AuthService.refreshTokens
    // compares `storedToken.userId !== undefined` (and `undefined` is
    // never equal to a real cuid).
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      refreshToken,
    };
  }
}
