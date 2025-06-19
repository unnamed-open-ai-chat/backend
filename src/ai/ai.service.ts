import { Injectable } from '@nestjs/common';

import { Message } from '@/messages/schemas/message.schema';
import { StorageService } from '@/storage/storage.service';
import { AnthropicClient } from './clients/anthropic.client';
import { GoogleClient } from './clients/google.client';
import { OpenAIClient } from './clients/openai.client';
import { OpenRouterClient } from './clients/openrouter.client';
import {
    AIModel,
    AIProviderCallbacks,
    AIProviderClient,
    AIProviderId,
    AIProviderOptions,
} from './interfaces/ai-provider.interface';

@Injectable()
export class AIService {
    private readonly clients: Record<AIProviderId, AIProviderClient>;

    constructor(private readonly storageService: StorageService) {
        this.clients = {
            anthropic: new AnthropicClient(),
            google: new GoogleClient(),
            openrouter: new OpenRouterClient(this.storageService),
            openai: new OpenAIClient(this.storageService),
        };
    }

    async validateKeyFormat(providerId: AIProviderId, key: string): Promise<boolean> {
        const provider = this.clients[providerId];
        const models = await provider.getModels(key).catch(() => []);
        return models.length > 0;
    }

    async getModels(providerId: AIProviderId, key: string): Promise<AIModel[]> {
        return this.clients[providerId].getModels(key);
    }

    async countInputTokens(
        providerId: AIProviderId,
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions
    ): Promise<number> {
        return this.clients[providerId].countInputTokens(key, modelId, messages, settings);
    }

    sendMessage(
        providerId: AIProviderId,
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions,
        callbacks: AIProviderCallbacks
    ): Promise<unknown> {
        return this.clients[providerId].sendMessage(key, modelId, messages, settings, callbacks);
    }

    generateImage(
        providerId: AIProviderId,
        key: string,
        modelId: string,
        promptOrMessages: string | Message[],
        settings: AIProviderOptions,
        callbacks: AIProviderCallbacks
    ): Promise<unknown> {
        return this.clients[providerId].generateImage(
            key,
            modelId,
            promptOrMessages,
            settings,
            callbacks
        );
    }
}
