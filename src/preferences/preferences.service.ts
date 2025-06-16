import { WebsocketsService } from '@/websockets/websockets.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdatePreferencesDto } from './dto/update-preferences.schema';
import { PreferencesDocument, UserPreferences } from './schema/user-preference.schema';

@Injectable()
export class PreferencesService {
    constructor(
        @InjectModel(UserPreferences.name) private preferencesModel: Model<PreferencesDocument>,
        private readonly websocketsService: WebsocketsService
    ) {}

    async createForUser(userId: string): Promise<PreferencesDocument> {
        const preferences = new this.preferencesModel({ userId });
        return preferences.save();
    }

    async findByUserId(userId: string): Promise<PreferencesDocument> {
        const preferences = await this.preferencesModel.findOne({ userId });
        if (!preferences) {
            throw new NotFoundException('Preferences not found for this user');
        }
        return preferences;
    }

    async updatePreferences(
        userId: string,
        updateData: UpdatePreferencesDto
    ): Promise<PreferencesDocument> {
        const preferences = await this.findByUserId(userId);
        Object.assign(preferences, updateData);
        this.websocketsService.emitPreferencesUpdated(userId, preferences);
        return preferences.save();
    }

    async deletePreferences(userId: string): Promise<PreferencesDocument | null> {
        return await this.preferencesModel.findOneAndDelete({ userId });
    }
}
