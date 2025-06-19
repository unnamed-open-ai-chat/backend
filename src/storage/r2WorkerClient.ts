import * as jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

export interface CreateResponse {
    success: boolean;
    error?: string;
    uploadId: string;
    fileId: string;
    totalParts: number;
    chunkSize: number;
    clientToken: string;
}

export interface CompleteResponse {
    success: boolean;
    error?: string;
    etag: string;
    size: number;
}

export class R2WorkerClient {
    constructor(
        private readonly url: string,
        private readonly secret: string
    ) {}

    private generateJwtTicket(type: string, action: string) {
        const now = Math.floor(Date.now() / 1000);

        return jwt.sign(
            {
                type,
                action,
                iat: now - 60, // Fix for clock skew
                exp: now + 6 * 60, // 5 minutes - 1 minute for clock skew
            },
            this.secret,
            {
                algorithm: 'HS256',
            }
        );
    }
    private async apiFetch<T>(
        method: string,
        path: string,
        action: string,
        body: any,
        headers = {}
    ): Promise<T> {
        const jwtTicket = this.generateJwtTicket('backend', action);
        const response = await fetch(`${this.url}/${path}`, {
            method,
            body: JSON.stringify(body),
            headers: {
                Authorization: `Bearer ${jwtTicket}`,
                'Content-Type': 'application/json',
                ...headers,
            },
        });
        return response.json() as T;
    }

    public async createUpload(
        fileId: string,
        fileSize: number,
        fileMimeType: string
    ): Promise<CreateResponse> {
        return this.apiFetch<CreateResponse>('POST', 'upload/create', 'create', {
            id: fileId,
            fileSize: fileSize,
            mimeType: fileMimeType,
        });
    }

    public async completeUpload(
        uploadId: string,
        fileId: string,
        parts: { partNumber: number; etag: string }[]
    ): Promise<CompleteResponse> {
        return this.apiFetch<CompleteResponse>(
            'POST',
            'upload/complete?fileId=' + fileId,
            'complete',
            {
                uploadId,
                parts,
            }
        );
    }

    public async abortUpload(uploadId: string, fileId: string): Promise<boolean> {
        const { success } = await this.apiFetch<{ success: boolean }>(
            'POST',
            'upload/abort/' + uploadId,
            'abort',
            {
                fileId,
            }
        );
        return success;
    }

    public async deleteFile(fileId: string): Promise<boolean> {
        const { success } = await this.apiFetch<{ success: boolean }>(
            'DELETE',
            'file/' + fileId,
            'delete',
            {}
        );
        return success;
    }

    public async uploadFileBuffer(clientToken: string, data: Buffer) {
        const parts: { partNumber: number; etag: string }[] = [];
        const chunks: Buffer[] = [];

        const chunkSize = 5 * 1024 * 1024; // 5MB
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const partNumber = i / chunkSize + 1;
            chunks.push(chunk);
            parts.push({ partNumber, etag: '' });
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const partNumber = i + 1;

            let endpoint = '/upload/part/' + partNumber;
            if (i === chunks.length - 1) {
                endpoint += '?isLast=true';
            }

            const res = await fetch(`${this.url}${endpoint}`, {
                method: 'PUT',
                body: chunk,
                headers: {
                    Authorization: `Bearer ${clientToken}`,
                },
            });

            const json = (await res.json()) as { etag: string };
            parts[i].etag = json.etag;
        }

        return parts;
    }

    public async createAndUploadFile(fileId: string, fileMimeType: string, data: Buffer) {
        const size = data.byteLength;
        const upload = await this.createUpload(fileId, size, fileMimeType);
        const parts = await this.uploadFileBuffer(upload.clientToken, data);
        return this.completeUpload(upload.uploadId, fileId, parts);
    }

    public getUrlForFile(fileId: string): string {
        return `${this.url}/file/${fileId}`;
    }

    public async readFileAsString(fileId: string): Promise<string> {
        const response = await fetch(`${this.url}/file/${fileId}`);
        return response.text();
    }

    public async readFileAsBuffer(fileId: string): Promise<Buffer> {
        const response = await fetch(`${this.url}/file/${fileId}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}
