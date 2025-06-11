import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UpdateUserDTO } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name)
        private userModel: Model<UserDocument>
    ) {}

    async create(
        userData: Omit<User, '_id' | 'isActive' | 'createdAt' | 'updatedAt' | 'emailVerified'>
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

        return user.save();
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

    async updateProfile(userId: string, updateData: UpdateUserDTO): Promise<UserDocument> {
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
