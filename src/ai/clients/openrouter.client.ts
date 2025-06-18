import OpenAI from 'openai';

import { Message, MessageRole } from '@/messages/schemas/message.schema';
import {
    AIModel,
    AIProviderCallbacks,
    AIProviderClient,
    AIProviderId,
    AIProviderOptions,
} from '../interfaces/ai-provider.interface';

export class OpenRouterClient implements AIProviderClient {
    private createClient(key: string): OpenAI {
        return new OpenAI({
            apiKey: key,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': process.env.APP_NAME || 'Your App Name',
            },
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

        for (const model of response.data) {
            if (!model.id) {
                console.log('Invalid model:', model);
                continue;
            }

            // Extract model name and author from the model id
            // OpenRouter model IDs are typically in format: "author/model-name"
            const [author, ...nameParts] = model.id.split('/');
            const name = nameParts.join('/') || model.id;

            models.push({
                id: model.id,
                name: name,
                author: author || 'Unknown',
                provider: AIProviderId.openrouter,
                enabled: true,
                capabilities: {
                    codeExecution: false,
                    fileAnalysis: false,
                    functionCalling: true,
                    imageAnalysis: model.id.includes('vision') || model.id.includes('gpt-4'),
                    imageGeneration:
                        model.id.includes('dall-e') ||
                        model.id.includes('stable-diffusion') ||
                        model.id.includes('midjourney') ||
                        model.id.includes('flux'),
                    textGeneration:
                        !model.id.includes('dall-e') && !model.id.includes('stable-diffusion'),
                    webBrowsing: false,
                },
            });
        }

        return models;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async countInputTokens(key: string, modelId: string, messages: Message[]): Promise<number> {
        // OpenRouter doesn't have a direct token counting endpoint
        // We'll use a rough estimation: ~4 characters per token
        let totalChars = 0;

        for (const message of messages) {
            for (const part of message.content) {
                if (part.text) {
                    totalChars += part.text.length;
                }
            }
        }

        return Math.ceil(totalChars / 4);
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
        const openAIMessages = messages.map(message => ({
            role: message.role === MessageRole.user ? ('user' as const) : ('assistant' as const),
            content: message.content
                .filter(part => part.text)
                .map(part => part.text!)
                .join('\n'),
        }));

        try {
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
