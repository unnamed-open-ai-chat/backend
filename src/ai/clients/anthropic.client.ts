import Anthropic from '@anthropic-ai/sdk';
import { MessageStreamParams } from '@anthropic-ai/sdk/resources/index';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages';

import { Message } from '@/messages/schemas/message.schema';
import {
    AIModel,
    AIProviderCallbacks,
    AIProviderClient,
    AIProviderId,
    AIProviderOptions,
} from '../interfaces/ai-provider.interface';

export class AnthropicClient implements AIProviderClient {
    async validateKeyFormat(key: string): Promise<boolean> {
        const models = await this.getModels(key).catch(() => []);
        return models.length > 0;
    }

    async getModels(key: string): Promise<AIModel[]> {
        const client = new Anthropic({ apiKey: key });
        const raws = await client.models.list();

        return raws.data.map(model => ({
            id: model.id,
            name: model.display_name,
            author: 'Anthropic',
            provider: AIProviderId.anthropic,
            capabilities: {
                codeExecution: false,
                fileAnalysis: false,
                functionCalling: false,
                imageAnalysis: false,
                imageGeneration: false,
                textGeneration: true,
                webBrowsing: false,
            },
        }));
    }

    async countInputTokens(
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions
    ): Promise<number> {
        const client = new Anthropic({ apiKey: key });

        const history: Array<MessageParam> = messages.map(message => ({
            role: message.role,
            content: message.content,
        })) as Array<MessageParam>;

        const params: MessageStreamParams = {
            messages: history,
            model: modelId,
            max_tokens: settings.maxTokens || 1024,
            temperature: settings.temperature,
        };

        return (await client.messages.countTokens(params)).input_tokens;
    }

    async sendMessage(
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions,
        callbacks: AIProviderCallbacks
    ): Promise<void> {
        const client = new Anthropic({ apiKey: key });

        const history: Array<MessageParam> = messages.map(message => ({
            role: message.role,
            content: message.content,
        })) as Array<MessageParam>;

        const params: MessageStreamParams = {
            messages: history,
            model: modelId,
            max_tokens: settings.maxTokens || 1024,
            temperature: settings.temperature,
        };

        return new Promise(resolve => {
            client.messages
                .stream(params)
                .on('text', text => {
                    callbacks.onText(text);
                })
                .on('end', () => {
                    callbacks.onEnd();
                    resolve();
                })
                .on('error', err => {
                    callbacks.onError(err.message);
                    resolve();
                });
        });
    }
}
