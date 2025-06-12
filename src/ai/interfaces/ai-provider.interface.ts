import { registerEnumType } from '@nestjs/graphql';

import { Message } from '@/chats/schemas/message.schema';

export interface AIModelCapabilities {
    textGeneration: boolean;
    imageGeneration: boolean;
    imageAnalysis: boolean;
    functionCalling: boolean;
    webBrowsing: boolean;
    codeExecution: boolean;
    fileAnalysis: boolean;
}

export interface AIModel {
    id: string;
    name: string;
    capabilities: AIModelCapabilities;
}

export type AIProviderOptions = {
    maxTokens?: number;
    temperature?: number;
};

export type AIProviderCallbacks = {
    onError: (error: string) => Promise<void>;
    onText: (text: string) => Promise<void>;
    onEnd: () => Promise<void>;
};

export interface AIProviderClient {
    validateKeyFormat(key: string): Promise<boolean>;

    getModels(key: string): Promise<AIModel[]>;

    countInputTokens(
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions
    ): Promise<number>;

    sendMessage(
        key: string,
        modelId: string,
        messages: Message[],
        settings: { maxTokens?: number; temperature?: number },
        callbacks: AIProviderCallbacks
    ): Promise<unknown>;
}

export enum AIProviderId {
    // OPENAI = 'openai',
    anthropic = 'anthropic',
    // OPENROUTER = 'openrouter',
    google = 'google',
}

registerEnumType(AIProviderId, {
    name: 'AIProviderId',
});
