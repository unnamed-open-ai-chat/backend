import { Module } from '@nestjs/common';

import { FileUploadModule } from '@/files/files.module';
import { AIService } from './ai.service';

@Module({
    imports: [FileUploadModule],
    providers: [AIService],
    exports: [AIService],
})
export class AIModule {}
