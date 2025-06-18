import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import { Message } from '@/messages/schemas/message.schema';

@ObjectType()
export class AIModelCapabilities {
    @Field()
    textGeneration: boolean;
    @Field()
    imageGeneration: boolean;
    @Field()
    imageAnalysis: boolean;
    @Field()
    functionCalling: boolean;
    @Field()
    webBrowsing: boolean;
    @Field()
    codeExecution: boolean;
    @Field()
    fileAnalysis: boolean;
}

@ObjectType()
export class AIModel {
    @Field()
    id: string;
    @Field()
    name: string;
    @Field()
    author: string;
    @Field(() => String)
    provider: AIProviderId;
    @Field()
    capabilities: AIModelCapabilities;
    @Field({ nullable: true })
    enabled?: boolean;
    @Field({ nullable: true })
    description?: string;
    @Field({ nullable: true })
    category?: string;
    @Field(() => String, { nullable: true })
    cost?: AIModelPropValue;
    @Field(() => String, { nullable: true })
    speed?: AIModelPropValue;
}

export type AIProviderOptions = {
    maxTokens?: number;
    temperature?: number;
    imageGeneration?: {
        size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
        quality?: 'standard' | 'hd';
        style?: 'vivid' | 'natural';
        n?: number;
    };
};

export type AIProviderCallbacks = {
    onError: (error: string) => Promise<void>;
    onText: (text: string) => Promise<void>;
    onEnd: () => Promise<void>;

    onMediaGenStart?: (type: 'image' | 'audio' | 'video') => Promise<void>;
    onMediaGenEnd?: (
        mediaUrl: string,
        type: 'image' | 'audio' | 'video',
        metadata?: any
    ) => Promise<void>;
    onMediaGenError?: (error: string, type: 'image' | 'audio' | 'video') => Promise<void>;
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

    generateImage(
        key: string,
        modelId: string,
        promptOrMessages: string | Message[],
        settings: AIProviderOptions,
        callbacks: AIProviderCallbacks
    );
}

export enum AIProviderId {
    openai = 'openai',
    anthropic = 'anthropic',
    openrouter = 'openrouter',
    google = 'google',
}

registerEnumType(AIProviderId, {
    name: 'AIProviderId',
});

export enum AIModelPropValue {
    low = 'low',
    medium = 'medium',
    high = 'high',
}

registerEnumType(AIModelPropValue, {
    name: 'AIModelPropValue',
});
