import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import * as path from 'path';

import { AIModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { ChatsModule } from './chats/chats.module';
import { EncryptionModule } from './encryption/encryption.module';
import { ApiKeysModule } from './keys/api-key.module';
import { MessagesModule } from './messages/messages.module';
import { PreferencesModule } from './preferences/preferences.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';
import { WebsocketsModule } from './websockets/websockets.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
    imports: [
        // Configuration (Load .env file if exist)
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Database (MongoDB)
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                uri: config.get<string>('MONGODB_URI'),
            }),
        }),

        // GraphQL
        GraphQLModule.forRootAsync<ApolloDriverConfig>({
            driver: ApolloDriver,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                autoSchemaFile: path.join(process.cwd(), 'src/schema.gql'),
                sortSchema: true,
                playground: config.get<string>('NODE_ENV') === 'development',
                introspection: config.get<string>('NODE_ENV') === 'development',
                context: ({ req, res }: any) => ({ req, res }),
                subscriptions: {
                    'graphql-ws': true,
                    'subscriptions-transport-ws': true,
                },
            }),
        }),

        // Bull Queue (Uses Redis)
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                redis: {
                    host: config.get<string>('REDIS_HOST'),
                    port: config.get<number>('REDIS_PORT'),
                    password: config.get<string>('REDIS_PASSWORD'),
                    tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
                },
                defaultJobOptions: {
                    removeOnComplete: 100,
                    removeOnFail: 100,
                },
                settings: {
                    stalledInterval: 30 * 1000, // 30s
                    maxStalledCount: 10,
                    drainDelay: 300, // 300 ms
                },
            }),
        }),

        // Feature Modules
        AIModule,
        ApiKeysModule,
        AuthModule,
        BranchesModule,
        ChatsModule,
        EncryptionModule,
        MessagesModule,
        SessionsModule,
        UsersModule,
        PreferencesModule,
        WebsocketsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
