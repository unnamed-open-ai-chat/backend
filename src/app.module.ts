import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import * as path from 'path';

import { BullModule } from '@nestjs/bull';
import { AIModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { EncryptionModule } from './encryption/encryption.module';
import { ApiKeysModule } from './keys/api-key.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';

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
        AuthModule,
        ChatsModule,
        EncryptionModule,
        ApiKeysModule,
        SessionsModule,
        UsersModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
