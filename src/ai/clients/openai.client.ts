import OpenAI from 'openai';

import { Message, MessageRole } from '@/messages/schemas/message.schema';
import {
    AIModel,
    AIProviderCallbacks,
    AIProviderClient,
    AIProviderId,
    AIProviderOptions,
} from '../interfaces/ai-provider.interface';

export class OpenAIClient implements AIProviderClient {
    private createClient(key: string): OpenAI {
        return new OpenAI({
            apiKey: key,
        });
    }

    async validateKeyFormat(key: string): Promise<boolean> {
        try {
            const models = await this.getModels(key);
            return models.length > 0;
        } catch {
            return false;
        }
    }

    async getModels(key: string): Promise<AIModel[]> {
        const client = this.createClient(key);
        const response = await client.models.list();
        const models: AIModel[] = [];

        // Filter only chat completion models
        const chatModels = response.data.filter(
            model =>
                model.id.includes('gpt') || model.id.includes('o1') || model.id.includes('chatgpt')
        );

        for (const model of chatModels) {
            if (!model.id) {
                console.log('Invalid model:', model);
                continue;
            }

            // Determine capabilities based on model name
            const isVisionModel =
                model.id.includes('vision') ||
                model.id.includes('gpt-4') ||
                model.id.includes('gpt-4o');

            const isFunctionCallingModel = !model.id.includes('o1'); // o1 models don't support function calling

            const isLatestModel =
                model.id.includes('gpt-4') ||
                model.id.includes('gpt-3.5') ||
                model.id.includes('o1');

            models.push({
                id: model.id,
                name: model.id,
                author: 'OpenAI',
                provider: AIProviderId.openai,
                enabled: isLatestModel, // Only enable commonly used models by default
                capabilities: {
                    codeExecution: false,
                    fileAnalysis: false,
                    functionCalling: isFunctionCallingModel,
                    imageAnalysis: isVisionModel,
                    imageGeneration: false, // DALL-E is separate
                    textGeneration: true,
                    webBrowsing: false,
                },
            });
        }

        return models;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async countInputTokens(key: string, modelId: string, messages: Message[]): Promise<number> {
        // OpenAI doesn't have a direct token counting endpoint in the API
        // Here's a rough estimation: ~4 characters per token for English text
        let totalChars = 0;

        for (const message of messages) {
            for (const part of message.content) {
                if (part.text) {
                    totalChars += part.text.length;
                }
            }
        }

        // Add some overhead for message formatting
        const messageOverhead = messages.length * 10;
        return Math.ceil((totalChars + messageOverhead) / 4);
    }

    async generateImage(
        key: string,
        modelId: string,
        promptOrMessages: string | Message[],
        settings: AIProviderOptions,
        callbacks: AIProviderCallbacks
    ) {
        const client = this.createClient(key);

        const prompt =
            typeof promptOrMessages === 'string'
                ? promptOrMessages
                : promptOrMessages[promptOrMessages.length - 1]?.content
                      .filter(part => part.text)
                      .map(part => part.text!)
                      .join('\n') || '';

        try {
            if (callbacks.onMediaGenStart) {
                await callbacks.onMediaGenStart('image');
            }

            const response = await client.images.generate({
                model: modelId,
                prompt: prompt,
                n: settings.imageGeneration?.n || 1,
                size: settings.imageGeneration?.size || '1024x1024',
                quality: settings.imageGeneration?.quality || 'standard',
                style: settings.imageGeneration?.style || 'vivid',
            });

            for (const image of response?.data || []) {
                if (image.url) {
                    const metadata = {
                        prompt: prompt,
                        revisedPrompt: image.revised_prompt,
                        model: modelId,
                        size: settings.imageGeneration?.size || '1024x1024',
                        quality: settings.imageGeneration?.quality || 'standard',
                        style: settings.imageGeneration?.style || 'vivid',
                    };

                    if (callbacks.onMediaGenEnd) {
                        await callbacks.onMediaGenEnd(image.url, 'image', metadata);
                    }

                    await callbacks.onText(image.revised_prompt || '');
                }
            }

            await callbacks.onEnd();
        } catch (error: any) {
            const errorMessage = error?.message || 'Internal Error';

            if (callbacks.onMediaGenError) {
                await callbacks.onMediaGenError(errorMessage, 'image');
            }

            await callbacks.onError(errorMessage);
        }
    }

    async sendMessage(
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions,
        callbacks: AIProviderCallbacks
    ) {
        const client = this.createClient(key);

        // Convert messages to OpenAI format
        const openAIMessages = messages.map(message => {
            const role =
                message.role === MessageRole.user ? ('user' as const) : ('assistant' as const);
            const content = message.content
                .filter(part => part.text)
                .map(part => part.text!)
                .join('\n');

            return { role, content };
        });

        try {
            // Check if model supports streaming
            const supportsStreaming = !modelId.includes('o1'); // o1 models don't support streaming

            if (supportsStreaming) {
                const stream = await client.chat.completions.create({
                    model: modelId,
                    messages: openAIMessages,
                    temperature: settings.temperature,
                    max_tokens: settings.maxTokens,
                    stream: true,
                });

                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content;

                    if (content) {
                        callbacks.onText(content).catch(error => {
                            console.error('Error in onText callback:', error);
                        });
                    }
                }
            } else {
                // For models that don't support streaming (like o1)
                const response = await client.chat.completions.create({
                    model: modelId,
                    messages: openAIMessages,
                    temperature: settings.temperature,
                    max_tokens: settings.maxTokens,
                });

                const content = response.choices[0]?.message?.content;
                if (content) {
                    callbacks.onText(content).catch(error => {
                        console.error('Error in onText callback:', error);
                    });
                }
            }

            callbacks.onEnd().catch(error => {
                console.error('Error in onEnd callback:', error);
            });
        } catch (error: any) {
            const message = error?.message || 'Unknown error';
            callbacks.onError(message).catch(err => {
                console.error('Error in onError callback:', err);
            });
        }
    }
}
