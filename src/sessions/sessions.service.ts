import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Session, SessionDocument } from './schemas/session.schema';

@Injectable()
export class SessionsService {
    constructor(
        @InjectModel(Session.name)
        private sessionModel: Model<SessionDocument>
    ) {}

    async createSession(
        sessionData: Omit<Session, '_id' | 'isActive' | 'lastUsedAt'>
    ): Promise<Session> {
        const session = new this.sessionModel({
            ...sessionData,
            isActive: true,
            lastUsedAt: Date.now(),
        });
        return session.save();
    }

    async findByRefreshToken(refreshToken: string): Promise<Session | null> {
        return this.sessionModel
            .findOne({ refreshToken, isActive: true, expiresAt: { $gt: Date.now() } })
            .exec();
    }

    async findById(id: string): Promise<Session | null> {
        return this.sessionModel.findById(id).exec();
    }

    async findByUserId(userId: string): Promise<Session[]> {
        return this.sessionModel
            .find({ userId, isActive: true, expiresAt: { $gt: Date.now() } })
            .exec();
    }

    async updateTokens(
        sessionId: string,
        refreshToken: string,
        accessToken: string
    ): Promise<Session> {
        const session = await this.sessionModel
            .findByIdAndUpdate(
                sessionId,
                {
                    refreshToken,
                    accessToken,
                    lastUsedAt: new Date(),
                },
                { new: true }
            )
            .exec();

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        return session;
    }

    async revokeSession(userId: string, sessionId: string): Promise<void> {
        await this.sessionModel
            .findOneAndUpdate({ _id: sessionId, userId }, { isActive: false })
            .exec();
    }

    async revokeAllUserSessions(userId: string) {
        await this.sessionModel.updateMany({ userId }, { isActive: false }).exec();
    }

    async cleanupExpiredSessions(): Promise<void> {
        await this.sessionModel
            .deleteMany({
                $or: [{ expiresAt: { $lt: Date.now() } }, { isActive: false }],
            })
            .exec();
    }
}
