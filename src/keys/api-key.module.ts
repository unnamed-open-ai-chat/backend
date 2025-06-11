import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AIModule } from '@/ai/ai.module';
import { EncryptionModule } from '@/encryption/encryption.module';
import { UsersModule } from '@/users/users.module';
import { ApiKeyResolver } from './api-key.resolver';
import { ApiKeysService } from './api-key.service';
import { ApiKey, ApiKeySchema } from './schemas/api-key.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }]),
        EncryptionModule,
        UsersModule,
        AIModule,
    ],
    providers: [ApiKeysService, ApiKeyResolver],
    exports: [ApiKeysService],
})
export class ApiKeysModule {}
