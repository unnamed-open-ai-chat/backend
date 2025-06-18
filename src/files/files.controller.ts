import {
    BadRequestException,
    Controller,
    Get,
    Param,
    PayloadTooLargeException,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import * as busboy from 'busboy';
import { Request, Response } from 'express';

import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileUploadService } from './files.service';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileUploadController {
    constructor(private readonly fileUploadService: FileUploadService) {}

    @Post('upload')
    async uploadFile(@Req() req: Request, @CurrentUser() user: AccessJwtPayload) {
        return new Promise((resolve, reject) => {
            const bb = busboy({
                headers: req.headers,
                limits: {
                    fileSize: 10 * 1024 * 1024, // 10MB
                    files: 1, // Only one file at a time
                },
            });

            let fileProcessed = false;

            const processFile = async (file: any, info: any) => {
                const { filename, mimeType } = info;

                fileProcessed = true;

                // Pre-validate before processing stream
                this.fileUploadService.validateMimeType(mimeType);

                // Process the file stream
                const result = await this.fileUploadService.processStreamUpload(
                    file,
                    filename,
                    mimeType,
                    user.sub
                );

                if (!result.success || result.error) {
                    throw new BadRequestException(
                        result.error || 'File upload failed (Unknown error)'
                    );
                }

                return result;
            };

            bb.on('file', (_, file, info) => {
                if (fileProcessed) {
                    file.resume(); // Drain the stream
                    return;
                }

                processFile(file, info)
                    .then(result => {
                        resolve({
                            message: 'File uploaded successfully',
                            file: result,
                        });
                    })
                    .catch(error => {
                        file.resume(); // Drain the stream
                        reject(error as Error);
                    });
            });

            bb.on('error', error => {
                const err = error as any;
                if (err.code === 'LIMIT_FILE_SIZE') {
                    reject(new PayloadTooLargeException('File too large'));
                } else {
                    reject(new BadRequestException('Upload failed'));
                }
            });

            bb.on('finish', () => {
                if (!fileProcessed) {
                    reject(new BadRequestException('No file uploaded'));
                }
            });

            req.pipe(bb);
        });
    }

    @Get('serve/:id')
    async serveFile(
        @Param('id') id: string,
        @Res() res: Response,
        @CurrentUser() user: AccessJwtPayload
    ) {
        try {
            const { stream, file } = await this.fileUploadService.getFileStream(id, user.sub);

            // Set appropriate headers
            res.setHeader('Content-Type', file.mimetype);
            res.setHeader('Content-Length', file.size);
            res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);

            stream.pipe(res);
        } catch {
            res.status(404).json({ message: 'File not found' });
        }
    }

    @Get('download/:id')
    async downloadFile(
        @Param('id') id: string,
        @Res() res: Response,
        @CurrentUser() user: AccessJwtPayload
    ) {
        try {
            const { stream, file } = await this.fileUploadService.getFileStream(id, user.sub);

            // Set download headers
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', file.size);
            res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);

            stream.pipe(res);
        } catch {
            res.status(404).json({ message: 'File not found' });
        }
    }
}
