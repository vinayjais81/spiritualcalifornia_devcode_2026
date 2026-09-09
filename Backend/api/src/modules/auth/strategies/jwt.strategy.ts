import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    };
    super(options);
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
    // Roles come from the database, not from the token.
    //
    // The token's `roles` claim is a snapshot taken at sign-in, and access
    // tokens live 15 minutes on top of a 7-day refresh — so a role granted or
    // revoked mid-session used to take effect only when the session happened to
    // refresh. Granting practitioners buyer access makes that visible: they are
    // told they can buy, and can't, for up to half an hour. It resolves itself,
    // which is the hardest kind of report to diagnose.
    //
    // findById already loads `roles` for the isActive check, so reading them
    // here costs nothing extra. Revocation now takes effect on the next
    // request, which matters more than the grant: a role removed for cause
    // should not survive in a token for another 15 minutes.
    //
    // The claim stays in the token for backward compatibility with anything
    // still decoding it client-side; the server no longer trusts it.
    return {
      id: payload.sub,
      email: payload.email,
      roles: user.roles.map((r) => r.role),
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? undefined,
      isEmailVerified: user.isEmailVerified,
      guideProfileId: user.guideProfile?.id ?? undefined,
      guideSlug: user.guideProfile?.slug ?? undefined,
    };
  }
}
