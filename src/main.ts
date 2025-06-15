import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    const environment = configService.get('NODE_ENV');

    if (!process.env.CORS_ORIGIN) {
        console.warn('CORS_ORIGIN is not set');
    }

    app.enableCors({
        origin: environment === 'development' ? '*' : process.env.CORS_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    await app.listen(configService.get('PORT') ?? 3000);
}

bootstrap().catch(console.error);
