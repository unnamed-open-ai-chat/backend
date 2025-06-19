import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FileSchema } from './schemas/file.schema';
import { StorageResolver } from './storage.resolver';
import { StorageService } from './storage.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: File.name, schema: FileSchema }])],
    providers: [StorageService, StorageResolver],
    exports: [StorageService],
})
export class StorageModule {}
