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
import { WebsocketsService } from './websockets.service';

@Injectable()
@WebSocketGateway({
    namespace: 'ws',
    transports: ['websocket', 'polling'],
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(WebsocketGateway.name);

    @WebSocketServer()
    server: Server;

    constructor(
        private websocketService: WebsocketsService,
        private jwtService: JwtService,
        private configService: ConfigService
    ) {}

    afterInit(server: Server) {
        this.websocketService.setServer(server);
        this.configureCors(server);
        this.logger.log('WebSocket Gateway initialized');
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

                // Associate socket with user through service
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

            // Remove client through service (handles all cleanup)
            this.websocketService.removeClient(client.id);
        } catch (error) {
            this.logger.error(`Error handling disconnection:`, error);
        }
    }

    // ===================
    // EVENT HANDLERS
    // ===================

    @SubscribeMessage('join-branch')
    @RateLimit(10, 10) // 10 requests per 10 seconds
    async handleJoinBranch(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { branchId: string }
    ) {
        try {
            if (!data.branchId) {
                throw new Error('Branch ID is required');
            }

            // Delegate to service
            const result = await this.websocketService.joinBranchRoom(client.id, data.branchId);

            return result;
        } catch (error) {
            this.logger.error(`Error in join-branch handler:`, error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    @SubscribeMessage('leave-branch')
    @RateLimit(10, 10)
    async handleLeaveBranch(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { branchId: string }
    ) {
        try {
            if (!data.branchId) {
                throw new Error('Branch ID is required');
            }

            // Delegate to service
            const result = await this.websocketService.leaveBranchRoom(client.id, data.branchId);

            return result;
        } catch (error) {
            this.logger.error(`Error in leave-branch handler:`, error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // ===================
    // UTILITY METHODS (moved to service, kept for backward compatibility)
    // ===================

    /**
     * @deprecated Use websocketService.getConnectedUserCount() instead
     */
    getConnectedUserCount(): number {
        return this.websocketService.getConnectedUserCount();
    }

    /**
     * @deprecated Use websocketService.isUserConnected() instead
     */
    isUserConnected(userId: string): boolean {
        return this.websocketService.isUserConnected(userId);
    }

    // ===================
    // PRIVATE METHODS
    // ===================

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
}
