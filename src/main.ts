import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const ALLOWED_FRONTEND = ['https://example.com', 'https://app.example.com'];

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    const environment = configService.get('NODE_ENV');

    app.enableCors({
        origin: environment === 'development' ? '*' : ALLOWED_FRONTEND,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    await app.listen(configService.get('PORT') ?? 3000);
}

bootstrap().catch(console.error);
