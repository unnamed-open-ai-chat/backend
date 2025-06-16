import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { WebsocketGateway } from './websockets.gateway';
import { WebsocketsService } from './websockets.service';

@Module({
    imports: [
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get('JWT_EXPIRATION'),
                },
            }),
        }),
    ],
    providers: [WebsocketGateway, WebsocketsService],
    exports: [WebsocketsService],
})
export class WebsocketsModule {}
