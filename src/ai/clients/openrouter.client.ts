import { StorageService } from '@/storage/storage.service';
import { AIProviderId } from '../interfaces/ai-provider.interface';
import { BaseOpenAIApiClient } from './base/base-openai-api.client';

export class OpenRouterClient extends BaseOpenAIApiClient {
    constructor(protected readonly storageService: StorageService) {
        super(AIProviderId.openrouter, storageService, 'https://openrouter.ai/api/v1');
    }
}
