import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PreferencesService } from '@/preferences/preferences.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name)
        private userModel: Model<UserDocument>,
        private readonly preferencesService: PreferencesService
    ) {}

    async create(
        userData: Omit<
            User,
            '_id' | 'isActive' | 'createdAt' | 'updatedAt' | 'emailVerified' | 'preferences'
        >
    ) {
        const existingUser = await this.findByEmail(userData.email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        const user = new this.userModel({
            ...userData,
            isActive: true,
            emailVerified: false,
            emailVerificationCode: 'dummy', // Todo: Add random generation.
        });

        const preferences = await this.preferencesService.createForUser(user._id.toString());

        user.preferences = preferences._id;
        await user.save();
        return user;
    }

    async findById(id: string): Promise<UserDocument> {
        const user = await this.userModel.findById(id).exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userModel.findOne({ email, isActive: true }).exec();
    }

    async updateUser(userId: string, updateData: UpdateUserDto): Promise<UserDocument> {
        if (updateData.email) {
            const existingUser = await this.findByEmail(updateData.email);
            if (existingUser) {
                throw new ConflictException('User with this email already exists');
            }
        }

        const user = await this.userModel
            .findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async updateLastLogin(userId: string) {
        return this.userModel.findByIdAndUpdate(userId, { lastLogin: new Date() }).exec();
    }
}
