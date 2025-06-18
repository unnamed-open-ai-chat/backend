import { GoogleGenAI } from '@google/genai';

import { Message, MessageRole } from '@/messages/schemas/message.schema';
import {
    AIModel,
    AIProviderCallbacks,
    AIProviderClient,
    AIProviderId,
    AIProviderOptions,
} from '../interfaces/ai-provider.interface';

export class GoogleClient implements AIProviderClient {
    async validateKeyFormat(key: string): Promise<boolean> {
        const models = await this.getModels(key).catch(() => []);
        return models.length > 0;
    }

    async getModels(key: string): Promise<AIModel[]> {
        const client = new GoogleGenAI({ apiKey: key });
        const raw = await client.models.list();
        const models: AIModel[] = [];

        for (const model of raw.page) {
            const actions = model.supportedActions;
            const id = model.name?.replace('models/', '');
            const name = model.displayName;

            if (!id || !name || !actions) {
                console.log('Invalid model:', model);
                continue;
            }

            models.push({
                id,
                name,
                author: 'Google',
                provider: AIProviderId.google,
                enabled: true,
                capabilities: {
                    codeExecution: false,
                    fileAnalysis: false,
                    functionCalling: false,
                    imageAnalysis: false,
                    imageGeneration: false,
                    textGeneration: actions.includes('generateContent'),
                    webBrowsing: false,
                },
            });
        }

        return models;
    }

    async countInputTokens(
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions
    ): Promise<number> {
        const client = new GoogleGenAI({ apiKey: key });

        const history = messages.map(message => ({
            role: message.role == MessageRole.user ? 'user' : 'model',
            parts: message.content
                .filter(part => part.text)
                .map(part => ({
                    text: part.text!,
                })),
        }));

        const chat = client.chats.create({
            model: modelId,
            history: history,
            config: {
                temperature: settings.temperature,
                maxOutputTokens: settings.maxTokens,
            },
        });

        const countTokensResponse = await client.models.countTokens({
            model: modelId,
            contents: chat.getHistory(),
        });

        return countTokensResponse.totalTokens || 0;
    }

    async sendMessage(
        key: string,
        modelId: string,
        messages: Message[],
        settings: AIProviderOptions,
        callbacks: AIProviderCallbacks
    ) {
        const client = new GoogleGenAI({ apiKey: key });
        const previousMessages = [...messages];
        const lastMessage = previousMessages.pop();

        const history = previousMessages.map(message => ({
            role: message.role == MessageRole.user ? 'user' : 'model',
            parts: message.content
                .filter(part => part.text)
                .map(part => ({
                    text: part.text!,
                })),
        }));

        const chat = client.chats.create({
            model: modelId,
            history,
            config: {
                temperature: settings.temperature,
                maxOutputTokens: settings.maxTokens,
            },
        });

        const response = await chat.sendMessageStream({
            config: {
                temperature: settings.temperature,
                maxOutputTokens: settings.maxTokens,
            },
            message:
                lastMessage?.content
                    .filter(part => part.text)
                    .map(part => part.text)
                    .join('\n') || '',
        });

        try {
            for await (const chunk of response) {
                if (!chunk.text) {
                    continue;
                }

                void callbacks.onText(chunk.text);
            }

            void callbacks.onEnd();
        } catch (error) {
            const message = (error.message as string) || 'Unknown error';
            void callbacks.onError(message);
        }
    }

    async generateImage(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        key: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        modelId: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        promptOrMessages: string | Message[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        settings: AIProviderOptions,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        callbacks: AIProviderCallbacks
    ) {}
}
