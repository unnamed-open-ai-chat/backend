import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserPreferencesModule } from '@/users-preferences/users-preferences.module';
import { User, UserSchema } from './schemas/user.schema';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: User.name,
                schema: UserSchema,
            },
        ]),
        UserPreferencesModule,
    ],
    providers: [UsersService, UsersResolver],
    exports: [UsersService],
})
export class UsersModule {}
