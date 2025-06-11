import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { UseGuards } from '@nestjs/common';
import { SessionResponse } from 'src/sessions/schemas/session.schema';
import { User } from 'src/users/schemas/user.schema';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDTO } from './dto/change-password.dto';
import { LoginDTO } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { AccessJwtPayload } from './interfaces/jwt-payload.interface';

@Resolver(() => SessionResponse)
export class AuthResolver {
    constructor(private readonly authService: AuthService) {}

    @Mutation(() => SessionResponse)
    async register(
        @Args('payload') payload: RegisterDto,
        @Context() context: any
    ): Promise<SessionResponse> {
        const req = context.req;
        const deviceInfo = this.createDeviceInfo(req);
        return await this.authService.register(payload, deviceInfo);
    }

    @Mutation(() => SessionResponse)
    async login(
        @Args('payload') payload: LoginDTO,
        @Context() context: any
    ): Promise<SessionResponse> {
        const req = context.req;
        const deviceInfo = this.createDeviceInfo(req);
        return this.authService.login(payload, deviceInfo);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => User)
    async updatePassword(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: ChangePasswordDTO
    ): Promise<User> {
        return await this.authService.updatePassword(user.sub, payload);
    }

    @Mutation(() => SessionResponse)
    async refreshToken(@Args('refreshToken') refreshToken: string): Promise<SessionResponse> {
        return this.authService.refreshTokens(refreshToken);
    }

    @Query(() => [SessionResponse])
    @UseGuards(GqlAuthGuard)
    async getSessions(@CurrentUser() user: AccessJwtPayload): Promise<SessionResponse[]> {
        return await this.authService.getUserSessions(user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Boolean)
    async logout(@CurrentUser() user: AccessJwtPayload): Promise<boolean> {
        await this.authService.logout(user.sub, user.sessionId);
        return true;
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Boolean)
    async revokeSession(
        @Args('sessionId') sessionId: string,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<boolean> {
        await this.authService.logout(user.sub, sessionId);
        return true;
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Boolean)
    async revokeAllSessions(@CurrentUser() user: AccessJwtPayload): Promise<boolean> {
        await this.authService.logoutAll(user.sub);
        return true;
    }

    private createDeviceInfo(req: any) {
        const ua: string = req.headers['user-agent'] || 'unknown';

        return {
            userAgent: ua,
            ip: req.ip || req.connection.remoteAddress || '0.0.0.0',
            platform: this.extractPlatform(ua),
            browser: this.extractBrowser(ua),
        };
    }

    private extractPlatform(userAgent?: string): string {
        if (!userAgent) return 'unknown';

        if (userAgent.includes('Windows')) return 'windows';
        if (userAgent.includes('Mac')) return 'macOS';
        if (userAgent.includes('Linux')) return 'linux';
        if (userAgent.includes('Android')) return 'android';
        if (userAgent.includes('iPhone') || userAgent.includes('ipad')) return 'ios';

        return 'unknown';
    }

    private extractBrowser(userAgent?: string): string {
        if (!userAgent) return 'unknown';

        if (userAgent.includes('Chrome')) return 'chrome';
        if (userAgent.includes('Firefox')) return 'firefox';
        if (userAgent.includes('Safari')) return 'safari';
        if (userAgent.includes('Edge')) return 'edge';
        if (userAgent.includes('Opera')) return 'ppera';

        return 'unknown';
    }
}
