import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { RateLimit } from './decorators/rate-limit.decorator';
import { WebsocketService } from './websockets.service';

@Injectable()
@WebSocketGateway({
    namespace: 'ws',
    transports: ['websocket', 'polling'],
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(WebsocketGateway.name);
    private readonly connectedUsers = new Map<string, string>(); // socketId -> userId

    @WebSocketServer()
    server: Server;

    constructor(
        private websocketService: WebsocketService,
        private jwtService: JwtService,
        private configService: ConfigService
    ) {}

    afterInit(server: Server) {
        this.logger.log('WebSocket server initialized');
        this.configureCors(server);
    }

    private configureCors(server: Server) {
        const corsOrigin = this.configService.get<string>('CORS_ORIGIN');
        const allowedOrigins = this.configService.get<string[]>('CORS_ALLOWED_ORIGINS') || [
            corsOrigin,
        ];

        // Apply corsOptions to the WebSocket server
        server.on('initial_headers', (headers: any, req: any) => {
            const origin = req.headers.origin;
            if (origin && allowedOrigins.includes(origin)) {
                headers['Access-Control-Allow-Origin'] = origin;
                headers['Access-Control-Allow-Credentials'] = 'true';
            }
        });
    }

    handleConnection(client: Socket) {
        try {
            this.logger.log(`Client connected: ${client.id}`);

            // Add client to service
            this.websocketService.addClient(client.id, client);

            // Extract token from handshake
            const token = this.extractTokenFromHandshake(client);

            if (!token) {
                this.logger.warn(`No token provided for socket ${client.id}`);
                client.emit('connection:error', { message: 'No authentication token provided' });
                client.disconnect();
                return;
            }

            // Validate token
            try {
                const payload = this.validateToken(token);

                // Associate socket with user
                this.connectedUsers.set(client.id, payload.sub);
                this.websocketService.associateUserWithSocket(payload.sub, client.id);

                // Send success message
                client.emit('auth_success', {
                    message: 'Successfully connected to WebSocket server',
                    userId: payload.sub,
                });

                this.logger.log(
                    `Authenticated user ${payload.sub} connected with socket ${client.id}`
                );
            } catch (error) {
                this.logger.error(`Authentication failed for socket ${client.id}:`, error.message);
                client.emit('auth_error', { message: 'Authentication failed' });
                client.disconnect();
            }
        } catch (error) {
            this.logger.error(`Error handling connection:`, error);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        try {
            this.logger.log(`Client disconnected: ${client.id}`);

            // Get user ID if authenticated
            const userId = this.connectedUsers.get(client.id);

            // Remove from tracking
            this.connectedUsers.delete(client.id);

            // Remove from service
            if (userId) {
                this.websocketService.removeUserFromSocket(userId, client.id);
            }
            this.websocketService.removeClient(client.id);
        } catch (error) {
            this.logger.error(`Error handling disconnection:`, error);
        }
    }

    // Listen for events
    @SubscribeMessage('join-branch')
    @RateLimit(10, 10) // 10 requests per 10 seconds
    handleJoinBranch(@ConnectedSocket() client: Socket, @MessageBody() data: { branchId: string }) {
        try {
            if (!data.branchId) {
                throw new Error('Branch ID is required');
            }

            const room = `branch:${data.branchId}`;

            // Join the room
            this.websocketService.joinRoom(client.id, room);

            return {
                success: true,
                room,
            };
        } catch (error) {
            this.logger.error(`Error joining branch:`, error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    @SubscribeMessage('leave-branch')
    handleLeaveBranch(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { branchId: string }
    ) {
        try {
            if (!data.branchId) {
                throw new Error('Branch ID is required');
            }

            const room = `branch:${data.branchId}`;

            // Leave the room
            this.websocketService.leaveRoom(client.id, room);

            return {
                success: true,
            };
        } catch (error) {
            this.logger.error(`Error leaving branch:`, error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // Method to emit auth token refresh to specific user
    emitTokenRefresh(userId: string, newTokens: { accessToken: string; refreshToken: string }) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('auth:token_refreshed', newTokens);
                this.logger.debug(`Token refresh sent to user ${userId} on socket ${socketId}`);
            }
        }
    }

    // Method to emit logout to specific user
    emitLogout(userId: string) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('auth:logout');
                this.logger.debug(`Logout signal sent to user ${userId} on socket ${socketId}`);
                // Disconnect the socket after logout
                socket.disconnect();
            }
        }
    }

    // Method to emit chat events to specific user
    emitChatCreated(userId: string, chat: any) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('chat:created', chat);
                this.logger.debug(
                    `Chat created event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    emitChatUpdated(userId: string, chat: any) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('chat:updated', chat);
                this.logger.debug(
                    `Chat updated event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    emitChatDeleted(userId: string, chatId: string) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('chat:deleted', chatId);
                this.logger.debug(
                    `Chat deleted event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    // Method to emit message events to specific user
    emitNewMessage(userId: string, message: any) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('message:new', message);
                this.logger.debug(`New message event sent to user ${userId} on socket ${socketId}`);
            }
        }
    }

    emitMessageUpdated(userId: string, message: any) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('message:updated', message);
                this.logger.debug(
                    `Message updated event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    emitMessageDeleted(userId: string, messageId: string) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('message:deleted', messageId);
                this.logger.debug(
                    `Message deleted event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    // Method to emit API key events to specific user
    emitApiKeyAdded(userId: string, apiKey: any) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('apikey:added', apiKey);
                this.logger.debug(
                    `API key added event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    emitApiKeyUpdated(userId: string, apiKey: any) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('apikey:updated', apiKey);
                this.logger.debug(
                    `API key updated event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    emitApiKeyDeleted(userId: string, apiKeyId: string) {
        const userSockets = this.websocketService.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.websocketService.connectedClients.get(socketId);
            if (socket) {
                socket.emit('apikey:deleted', apiKeyId);
                this.logger.debug(
                    `API key deleted event sent to user ${userId} on socket ${socketId}`
                );
            }
        }
    }

    private extractTokenFromHandshake(client: Socket): string | null {
        // Try to get token from handshake auth
        const auth = client.handshake.auth;
        if (auth && auth.token) {
            return auth.token;
        }

        // Try to get token from query params as fallback
        const query = client.handshake.query;
        if (query && query.token) {
            return query.token as string;
        }

        // Try to get token from headers as fallback
        const headers = client.handshake.headers;
        if (headers.authorization) {
            const parts = headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                return parts[1];
            }
        }

        return null;
    }

    private validateToken(token: string): AccessJwtPayload {
        try {
            // Verify token
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get<string>('JWT_SECRET'),
            });

            return payload;
        } catch {
            throw new UnauthorizedException('Invalid token');
        }
    }

    // Utility method to get connected user count
    getConnectedUserCount(): number {
        return this.connectedUsers.size;
    }

    // Utility method to check if user is connected
    isUserConnected(userId: string): boolean {
        return Array.from(this.connectedUsers.values()).includes(userId);
    }
}
