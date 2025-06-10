import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async create(
    userData: Omit<
      User,
      '_id' | 'isActive' | 'createdAt' | 'updatedAt' | 'emailVerified'
    >,
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

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email, isActive: true }).exec();
  }

  async updateLastLogin(userId: string) {
    return this.userModel
      .findByIdAndUpdate(userId, { lastLogin: new Date() })
      .exec();
  }
}
