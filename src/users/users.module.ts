import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PreferencesModule } from '@/preferences/preferences.module';
import { WebsocketsModule } from '@/websockets/websockets.module';
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
        PreferencesModule,
        WebsocketsModule,
    ],
    providers: [UsersService, UsersResolver],
    exports: [UsersService],
})
export class UsersModule {}
