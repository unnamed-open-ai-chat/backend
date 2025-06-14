import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import { Message } from '@/chats/schemas/message.schema';

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

export enum AIModelPropValue {
    low = 'low',
    medium = 'medium',
    high = 'high',
}

registerEnumType(AIModelPropValue, {
    name: 'AIModelPropValue',
});
