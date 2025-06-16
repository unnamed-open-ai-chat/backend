import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WebsocketsModule } from '@/websockets/websockets.module';
import { PreferencesResolver } from './preferences.resolver';
import { PreferencesService } from './preferences.service';
import { PreferencesSchema, UserPreferences } from './schema/user-preference.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: UserPreferences.name,
                schema: PreferencesSchema,
            },
        ]),
        WebsocketsModule,
    ],
    providers: [PreferencesService, PreferencesResolver],
    exports: [PreferencesService],
})
export class PreferencesModule {}
