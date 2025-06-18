import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FileUploadController } from './files.controller';
import { FileUploadResolver } from './files.resolver';
import { FileUploadService } from './files.service';
import { File, FileSchema } from './schemas/file.schema';

@Module({
    imports: [MongooseModule.forFeature([{ name: File.name, schema: FileSchema }])],
    providers: [FileUploadService, FileUploadResolver],
    controllers: [FileUploadController],
    exports: [FileUploadService],
})
export class FileUploadModule {}
