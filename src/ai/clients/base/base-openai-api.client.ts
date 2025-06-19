import OpenAI, { ClientOptions } from 'openai';
import { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/index';

import {
    AIModel,
    AIProviderCallbacks,
    AIProviderClient,
    AIProviderId,
    AIProviderOptions,
} from '@/ai/interfaces/ai-provider.interface';
import { Message, MessageRole } from '@/messages/schemas/message.schema';
import { StorageService } from '@/storage/storage.service';
export function extractNameAndAuthor(modelId: string): { name: string; author: string } {
    if (modelId.includes('/')) {
        const [author, ...nameParts] = modelId.split('/');
        const name = nameParts.join('/');
        return { name, author };
    } else {
        return { name: modelId, author: 'OpenAI' };
    }
}

export function normalizeOpenAIModel(
    model: OpenAI.Models.Model,
    provider: AIProviderId
): AIModel | null {
    if (!model.id) {
        return null;
    }

    const { author, name } = extractNameAndAuthor(model.id);

    const imageAnalysis = model.id.includes('vision') || model.id.includes('gpt-4');
    const functionCalling = !model.id.includes('o1');
    const imageGeneration =
        model.id.includes('dall-e') ||
        model.id.includes('stable-diffusion') ||
        model.id.includes('midjourney') ||
        model.id.includes('flux');
    const textGeneration = !model.id.includes('dall-e') && !model.id.includes('stable-diffusion');

    return {
        id: model.id,
        name: name,
        author: author || 'Unknown',
        provider: provider,
        enabled: true,
        capabilities: {
            codeExecution: false,
            fileAnalysis: false,
            functionCalling,
            imageAnalysis,
            imageGeneration,
            textGeneration,
            webBrowsing: false,
        },
    };
}

export async function messageToOpenAI(
    storageService: StorageService,
    message: Message,
    isLast: boolean
): Promise<ChatCompletionMessageParam> {
    const role = message.role === MessageRole.user ? 'user' : 'assistant';

    if (!isLast || role !== 'user' || message.attachments?.length == 0) {
        const content = message.content
            .filter(part => part.text)
            .map(part => part.text!)
            .join('\n');
        return { role, content };
    }

    const content: ChatCompletionContentPart[] = [];

    for (const messageContent of message.content) {
        if (messageContent.text) {
            content.push({ type: 'text', text: messageContent.text });
        }
    }

    for (const attachmentId of message.attachments) {
        const file = await storageService.getFileById(attachmentId.toString());
        let url = storageService.getUrlForFile(file._id);
        const isLocal = url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:');

        // Text plain
        if (file.mimetype === 'text/plain') {
            const text = await storageService.readFileAsPlainText(file._id);
            content.push({
                type: 'text',
                text: `[Attached File]:\n${text}`,
            });
            continue;
        }

        if (file.mimetype === 'application/pdf') {
            const pdfText = await storageService.readFileAsPDF(file._id);
            content.push({
                type: 'text',
                text: `[Attached PDF File (Extracted Text)]:\n${pdfText}`,
            });
            continue;
        }

        // URLs
        if (file.mimetype.startsWith('image/')) {
            if (isLocal) {
                url = await storageService.readFileAsBase64URL(file._id, file.mimetype);
                console.warn('Local url detected, using base64 url...');
            }

            content.push({
                type: 'image_url',
                image_url: {
                    url,
                },
            });
            continue;
        }

        // Base64 data
        const data = await storageService.readFileAsBase64Buffer(file._id);

        if (file.mimetype.startsWith('audio/')) {
            const isMp3 = file.mimetype === 'audio/mpeg';
            content.push({
                type: 'input_audio',
                input_audio: {
                    data,
                    format: isMp3 ? 'mp3' : 'wav',
                },
            });
            continue;
        }

        // Default
        content.push({
            type: 'file',
            file: {
                file_data: data,
                file_id: file._id,
                filename: file.filename,
            },
        });
    }

    return { role, content };
}

export abstract class BaseOpenAIApiClient implements AIProviderClient {
    protected readonly provider: AIProviderId;
    protected readonly storageService: StorageService;
    protected readonly apiEndpoint?: string | undefined;

    constructor(provider: AIProviderId, storageService: StorageService, apiEndpoint?: string) {
        this.provider = provider;
        this.storageService = storageService;
        this.apiEndpoint = apiEndpoint;

        this.sendMessage = this.sendMessage.bind(this);
        this.getModels = this.getModels.bind(this);
        this.countInputTokens = this.countInputTokens.bind(this);
        this.generateImage = this.generateImage.bind(this);

        if (!storageService) {
            throw new Error('Storage service is required for provider: ' + provider);
        }
    }

    private createClient(key: string): OpenAI {
        const settings: ClientOptions = {
            apiKey: key,
            defaultHeaders: {
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': process.env.APP_NAME || 'Your App Name',
            },
        };

        if (this.apiEndpoint) {
            settings.baseURL = this.apiEndpoint;
        }

        return new OpenAI(settings);
    }

    async getModels(key: string): Promise<AIModel[]> {
        const client = this.createClient(key);
        const response = await client.models.list();
        const models: AIModel[] = [];

        for (const model of response.data) {
            const normalized = normalizeOpenAIModel(model, this.provider);
            if (normalized) {
                models.push(normalized);
            }
        }

        return models;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async countInputTokens(_key: string, _modelId: string, messages: Message[]): Promise<number> {
        // OpenAI doesn't have a direct token counting endpoint
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

    async sendMessage(
        key: string,
        modelId: string,
        messages: Message[],
        settings: { maxTokens?: number; temperature?: number },
        callbacks: AIProviderCallbacks
    ): Promise<void> {
        const client = this.createClient(key);

        // Convert messages to OpenAI format
        const openAIMessages = await Promise.all(
            messages.map(
                async (message, index) =>
                    await messageToOpenAI(
                        this.storageService,
                        message,
                        index === messages.length - 1
                    )
            )
        );

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
}
