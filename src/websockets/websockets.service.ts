import { ChatBranch } from '@/branches/schemas/chat-branch.schema';
import { Chat } from '@/chats/schemas/chat.schema';
import { ApiKey } from '@/keys/schemas/api-key.schema';
import { UserPreferences } from '@/preferences/schema/user-preference.schema';
import { User } from '@/users/schemas/user.schema';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class WebsocketsService {
    private readonly logger = new Logger(WebsocketsService.name);
    private server: Server;
    public readonly connectedClients = new Map<string, Socket>(); // socketId -> Socket
    private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
    private readonly connectedUsers = new Map<string, string>(); // socketId -> userId
    private roomClients: Map<string, Set<string>> = new Map();

    setServer(server: Server): void {
        this.server = server;
        this.logger.log('WebSocket server initialized');
    }

    /**
     * Add a client to the connected clients map
     */
    addClient(socketId: string, socket: Socket): void {
        this.connectedClients.set(socketId, socket);
        this.logger.debug(`Client connected: ${socketId}`);
    }

    /**
     * Remove a client from the connected clients map
     */
    removeClient(socketId: string): void {
        // Get user ID before removing
        const userId = this.connectedUsers.get(socketId);

        // Remove from connected clients
        this.connectedClients.delete(socketId);
        this.connectedUsers.delete(socketId);

        // Remove from user sockets if user was authenticated
        if (userId) {
            this.removeUserFromSocket(userId, socketId);
        }

        // Remove from room clients
        for (const [room, clients] of this.roomClients.entries()) {
            if (clients.has(socketId)) {
                clients.delete(socketId);
                if (clients.size === 0) {
                    this.roomClients.delete(room);
                }
            }
        }

        this.logger.debug(`Client disconnected: ${socketId}`);
    }

    /**
     * Associate a user with a socket (after authentication)
     */
    associateUserWithSocket(userId: string, socketId: string): void {
        // Track socket -> userId mapping
        this.connectedUsers.set(socketId, userId);

        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());

            // Emit user online event if this is the first socket for this user
            if (this.server) {
                this.server.emit('user:online', { userId });
            }
        }

        this.userSockets.get(userId)!.add(socketId);
        this.logger.debug(`Associated user ${userId} with socket ${socketId}`);
    }

    /**
     * Remove a user from a socket
     */
    removeUserFromSocket(userId: string, socketId: string): void {
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
            userSocketSet.delete(socketId);

            // If no more sockets for this user, remove the user entry
            if (userSocketSet.size === 0) {
                this.userSockets.delete(userId);

                // Emit user offline event
                if (this.server) {
                    this.server.emit('user:offline', { userId });
                }
            }
        }

        this.logger.debug(`User ${userId} removed from socket ${socketId}`);
    }

    /**
     * Get user ID from socket ID
     */
    getUserIdFromSocket(socketId: string): string | undefined {
        return this.connectedUsers.get(socketId);
    }

    /**
     * Get all socket IDs for a specific user
     */
    getUserSockets(userId: string): string[] {
        return Array.from(this.userSockets.get(userId) || []);
    }

    /**
     * Get all socket IDs for a specific user as Set
     */
    getUserSocketsSet(userId: string): Set<string> {
        return this.userSockets.get(userId) || new Set();
    }

    /**
     * Get all connected users
     */
    getConnectedUsers(): string[] {
        return Array.from(this.userSockets.keys());
    }

    /**
     * Check if a user is online
     */
    isUserOnline(userId: string): boolean {
        const sockets = this.userSockets.get(userId);
        return !!sockets && sockets.size > 0;
    }

    /**
     * Check if user is connected (alias for backward compatibility)
     */
    isUserConnected(userId: string): boolean {
        return this.isUserOnline(userId);
    }

    /**
     * Get connected user count
     */
    getConnectedUserCount(): number {
        return this.userSockets.size;
    }

    /**
     * Get the total number of socket connections
     */
    getSocketConnectionCount(): number {
        return this.connectedClients.size;
    }

    // ===================
    // ROOM MANAGEMENT
    // ===================

    /**
     * Create branch room name with user isolation
     */
    createBranchRoom(userId: string, branchId: string): string {
        return `branch:${userId}:${branchId}`;
    }

    async joinRoom(socketId: string, room: string): Promise<void> {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
            await socket.join(room);

            // Track room membership
            if (!this.roomClients.has(room)) {
                this.roomClients.set(room, new Set());
            }
            this.roomClients.get(room)?.add(socketId);

            this.logger.debug(`Socket ${socketId} joined room ${room}`);
        }
    }

    async leaveRoom(socketId: string, room: string): Promise<void> {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
            await socket.leave(room);

            // Update room membership tracking
            const roomClients = this.roomClients.get(room);
            if (roomClients) {
                roomClients.delete(socketId);
                if (roomClients.size === 0) {
                    this.roomClients.delete(room);
                }
            }

            this.logger.debug(`Socket ${socketId} left room ${room}`);
        }
    }

    /**
     * Join branch room with user validation
     */
    async joinBranchRoom(
        socketId: string,
        branchId: string
    ): Promise<{ success: boolean; room?: string; error?: string }> {
        try {
            const userId = this.getUserIdFromSocket(socketId);
            if (!userId) {
                return { success: false, error: 'User not authenticated' };
            }

            const room = this.createBranchRoom(userId, branchId);
            await this.joinRoom(socketId, room);

            return { success: true, room };
        } catch (error) {
            this.logger.error(`Error joining branch room:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Leave branch room with user validation
     */
    async leaveBranchRoom(
        socketId: string,
        branchId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const userId = this.getUserIdFromSocket(socketId);
            if (!userId) {
                return { success: false, error: 'User not authenticated' };
            }

            const room = this.createBranchRoom(userId, branchId);
            await this.leaveRoom(socketId, room);

            return { success: true };
        } catch (error) {
            this.logger.error(`Error leaving branch room:`, error.message);
            return { success: false, error: error.message };
        }
    }

    getRoomClients(room: string): string[] {
        return Array.from(this.roomClients.get(room) || []);
    }

    getRoomCount(room: string): number {
        return this.roomClients.get(room)?.size || 0;
    }

    // ===================
    // EMISSION METHODS
    // ===================

    /**
     * Emit event to specific user (all their sockets)
     */
    emitToUser(userId: string, event: string, data: any): void {
        const userSockets = this.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.connectedClients.get(socketId);
            if (socket) {
                socket.emit(event, data);
                this.logger.debug(`Event ${event} sent to user ${userId} on socket ${socketId}`);
            }
        }
    }

    /**
     * Emit event to specific branch room
     */
    emitToBranch(userId: string, branchId: string, event: string, data: any): void {
        const room = this.createBranchRoom(userId, branchId);
        if (this.server) {
            this.server.to(room).emit(event, data);
            this.logger.debug(`Event ${event} sent to branch ${branchId} for user ${userId}`);
        }
    }

    /**
     * Emit to a specific socket
     */
    emitToSocket(socketId: string, event: string, data: any): void {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
            socket.emit(event, data);
            this.logger.debug(`Emitted event ${event} to socket ${socketId}`);
        } else {
            this.logger.warn(`Socket ${socketId} not found for event ${event}`);
        }
    }

    /**
     * Emit an event to all connected clients
     */
    emitToAll(event: string, data: any): void {
        if (!this.server) {
            this.logger.error('WebSocket server not initialized');
            return;
        }

        this.server.emit(event, data);
        this.logger.debug(`Event '${event}' emitted to all clients`);
    }

    // ===================
    // BUSINESS LOGIC EVENTS
    // ===================

    // Auth Events
    emitTokenRefresh(userId: string, newTokens: { accessToken: string; refreshToken: string }) {
        this.emitToUser(userId, 'auth:token_refreshed', newTokens);
    }

    emitLogout(userId: string) {
        const userSockets = this.getUserSockets(userId);

        for (const socketId of userSockets) {
            const socket = this.connectedClients.get(socketId);
            if (socket) {
                socket.emit('auth:logout');
                this.logger.debug(`Logout signal sent to user ${userId} on socket ${socketId}`);
                // Disconnect the socket after logout
                socket.disconnect();
            }
        }
    }

    // Chat Events
    emitChatCreated(userId: string, chat: Chat) {
        this.emitToUser(userId, 'chat:created', chat);
    }

    emitChatUpdated(userId: string, chat: Chat) {
        this.emitToUser(userId, 'chat:updated', chat);
    }

    emitChatDeleted(userId: string, chatId: string) {
        this.emitToUser(userId, 'chat:deleted', chatId);
    }

    // API Key Events
    emitApiKeyAdded(userId: string, apiKey: ApiKey) {
        this.emitToUser(userId, 'apikey:added', apiKey);
    }

    emitApiKeyUpdated(userId: string, apiKey: ApiKey) {
        this.emitToUser(userId, 'apikey:updated', apiKey);
    }

    emitApiKeyDeleted(userId: string, apiKeyId: string) {
        this.emitToUser(userId, 'apikey:deleted', apiKeyId);
    }

    // Message Events
    emitMessageAdd(userId: string, branchId: string, message: any) {
        this.emitToBranch(userId, branchId, 'message:added', message);
    }

    emitMessageUpdated(userId: string, messageId: string, message: any) {
        this.emitToUser(userId, 'message:updated', message);
    }

    emitMessageDeleted(userId: string, messageId: string) {
        this.emitToUser(userId, 'message:deleted', messageId);
    }

    // Branch Events
    emitBranchCreated(userId: string, branch: ChatBranch) {
        this.emitToUser(userId, 'branch:created', branch);
    }

    emitBranchUpdated(userId: string, branch: ChatBranch) {
        this.emitToUser(userId, 'branch:updated', branch);
    }

    emitBranchDeleted(userId: string, branchId: string) {
        this.emitToUser(userId, 'branch:deleted', branchId);
    }

    // User Events
    emitUserUpdated(userId: string, user: User) {
        this.emitToUser(userId, 'user:updated', user);
    }

    // Preferences Events
    emitPreferencesUpdated(userId: string, preferences: UserPreferences) {
        this.emitToUser(userId, 'preferences:updated', preferences);
    }

    // ===================
    // UTILITY METHODS
    // ===================

    /**
     * Disconnect all sockets for a specific user
     */
    disconnectUser(userId: string): void {
        const userSocketSet = this.userSockets.get(userId);

        if (!userSocketSet || userSocketSet.size === 0) {
            this.logger.warn(`No sockets found for user ${userId} to disconnect`);
            return;
        }

        let disconnectedCount = 0;
        for (const socketId of Array.from(userSocketSet)) {
            const socket = this.connectedClients.get(socketId);
            if (socket) {
                socket.disconnect(true);
                disconnectedCount++;
            }
        }

        this.logger.log(`Disconnected ${disconnectedCount} sockets for user ${userId}`);
    }

    /**
     * Get connection statistics
     */
    getConnectionStats(): {
        connectedUsers: number;
        totalConnections: number;
        averageConnectionsPerUser: number;
        userConnections: { userId: string; socketCount: number }[];
        rooms: { room: string; clientCount: number }[];
    } {
        const userConnections = Array.from(this.userSockets.entries()).map(([userId, sockets]) => ({
            userId,
            socketCount: sockets.size,
        }));

        const rooms = Array.from(this.roomClients.entries()).map(([room, clients]) => ({
            room,
            clientCount: clients.size,
        }));

        const totalConnections = this.connectedClients.size;
        const connectedUsers = this.userSockets.size;
        const averageConnectionsPerUser =
            connectedUsers > 0 ? totalConnections / connectedUsers : 0;

        return {
            connectedUsers,
            totalConnections,
            averageConnectionsPerUser: Math.round(averageConnectionsPerUser * 100) / 100,
            userConnections,
            rooms,
        };
    }

    /**
     * Clean up disconnected sockets (utility method for maintenance)
     */
    cleanupDisconnectedSockets(): number {
        let cleanedCount = 0;
        const socketsToRemove: string[] = [];

        // Find disconnected sockets
        for (const [socketId, socket] of this.connectedClients) {
            if (!socket.connected) {
                socketsToRemove.push(socketId);
            }
        }

        // Remove disconnected sockets
        for (const socketId of socketsToRemove) {
            this.removeClient(socketId);
            cleanedCount++;
        }

        if (cleanedCount > 0) {
            this.logger.log(`Cleaned up ${cleanedCount} disconnected sockets`);
        }

        return cleanedCount;
    }
}
