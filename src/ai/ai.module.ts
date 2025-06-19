import { Module } from '@nestjs/common';

import { StorageModule } from '@/storage/storage.module';
import { AIService } from './ai.service';

@Module({
    imports: [StorageModule],
    providers: [AIService],
    exports: [AIService],
})
export class AIModule {}
