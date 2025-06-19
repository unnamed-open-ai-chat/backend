import { StorageService } from '@/storage/storage.service';
import { AIProviderId } from '../interfaces/ai-provider.interface';
import { BaseOpenAIApiClient } from './base/base-openai-api.client';

export class OpenAIClient extends BaseOpenAIApiClient {
    constructor(protected readonly storageService: StorageService) {
        super(AIProviderId.openai, storageService, 'https://api.openai.com/v1');
    }
}
