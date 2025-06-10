import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import crypto from 'crypto';

import { EncryptionService } from 'src/encryption/encryption.service';
import { UsersService } from 'src/users/users.service';
import { SessionResponse } from '../sessions/schemas/session.schema';
import { SessionsService } from '../sessions/sessions.service';
import { comparePassword, User } from '../users/schemas/user.schema';
import { LoginDTO } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { DeviceInfo } from './interfaces/device-info.interface';
import { AccessJwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private sessionService: SessionsService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private encryptionService: EncryptionService
    ) {}

    async register(registerDto: RegisterDto, deviceInfo: DeviceInfo): Promise<SessionResponse> {
        const { email, password, displayName } = registerDto;

        // Check if user already exists
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Generate encryption keys for key vault
        const { encryptKey, decryptKey } = this.encryptionService.generateKeyPair();

        // Create user
        const user = await this.usersService.create({
            email,
            password,
            displayName,
            encryptKey,
            decryptKey,
        });

        // Create initial session
        return this.createUserSession(user, deviceInfo);
    }

    async login(loginDto: LoginDTO, deviceInfo: DeviceInfo): Promise<SessionResponse> {
        const { email, password } = loginDto;

        // Check if user exists
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Invalid Credentials');
        }

        // Validate password
        const passwordMatch = await comparePassword(password, user.password);
        if (!passwordMatch) {
            throw new UnauthorizedException('Invalid Credentials');
        }

        // Update last login
        await this.usersService.updateLastLogin(user._id.toString());

        // Create session
        return await this.createUserSession(user, deviceInfo);
    }

    async refreshTokens(refreshToken: string): Promise<SessionResponse> {
        try {
            // Find session
            const session = await this.sessionService.findByRefreshToken(refreshToken);

            if (!session || !session.isActive) {
                throw new UnauthorizedException('Invalid or expired refresh token');
            }

            // Find user
            const user = await this.usersService.findById(session.userId.toString());
            if (!user) {
                throw new UnauthorizedException('Invalid or expired refresh token');
            }

            // Generate new tokens
            const newAccessToken = this.generateAccessToken(user, session._id.toString());
            const newRefreshToken = this.generateRefreshToken(
                user._id.toString(),
                session._id.toString()
            );

            // Update session
            await this.sessionService.updateTokens(
                session._id.toString(),
                newRefreshToken,
                newAccessToken
            );

            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            };
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async logout(userId: string, sessionId: string) {
        await this.sessionService.revokeSession(userId, sessionId);
    }

    async logoutAll(userId: string) {
        await this.sessionService.revokeAllUserSessions(userId);
    }

    async getUserSessions(userId: string) {
        return this.sessionService.findByUserId(userId);
    }

    generateAccessToken(user: User, sessionId: string): string {
        const payload: AccessJwtPayload = {
            sub: user._id.toString(),
            email: user.email,
            sessionId,
        };

        return this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_SECRET'),
            expiresIn: this.configService.get('JWT_EXPIRATION'),
        });
    }

    generateRefreshToken(userId: string, sessionId: string): string {
        return this.jwtService.sign(
            { sub: userId, sessionId },
            {
                secret: this.configService.get('JWT_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
            }
        );
    }

    async createUserSession(user: User, deviceInfo: DeviceInfo): Promise<SessionResponse> {
        // Generate tokens
        const sessionId = crypto.randomUUID();
        const accessToken = this.generateAccessToken(user, sessionId);
        const refreshToken = this.generateRefreshToken(user._id.toString(), sessionId);

        // Calculate expiration (30 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Create session
        await this.sessionService.createSession({
            userId: user._id,
            refreshToken,
            accessToken,
            deviceInfo,
            expiresAt,
        });

        return {
            accessToken,
            refreshToken,
        };
    }
}
