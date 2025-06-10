import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionResponse } from 'src/sessions/schemas/session.schema';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Resolver(() => SessionResponse)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => SessionResponse)
  async register(
    @Args('payload') payload: RegisterDto,
    @Context() context: any,
  ): Promise<SessionResponse> {
    const req = context.req;
    const deviceInfo = this.createDeviceInfo(req);
    return await this.authService.register(payload, deviceInfo);
  }

  @Query(() => [SessionResponse])
  async getSessions(): Promise<SessionResponse[]> {
    return [];
  }

  createDeviceInfo(req: any) {
    return {
      userAgent: req.headers['user-agent'] || 'Unknown',
      ip: req.ip || req.connection.remoteAddress || '0.0.0.0',
      platform: req.headers['sec-ch-ua-platform'],
      browser: req.headers['sec-ch-ua'],
    };
  }
}
