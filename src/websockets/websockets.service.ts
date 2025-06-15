import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class WebsocketService {
    private readonly logger = new Logger(WebsocketService.name);
    private server: Server;
    public readonly connectedClients = new Map<string, Socket>(); // socketId -> Socket
    private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
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
        // Remove from connected clients
        this.connectedClients.delete(socketId);

        // Remove from user sockets
        for (const [userId, socketIds] of this.userSockets.entries()) {
            if (socketIds.has(socketId)) {
                socketIds.delete(socketId);
                if (socketIds.size === 0) {
                    this.userSockets.delete(userId);
                    // Emit user offline event if server is available
                    if (this.server) {
                        this.server.emit('user:offline', { userId });
                    }
                }
            }
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
     * Associate a user with a socket
     */
    associateUserWithSocket(userId: string, socketId: string): void {
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
     * Broadcast to a specific user (all their sockets)
     */
    broadcastToUser(userId: string, event: string, data: any): void {
        const socketIds = this.getUserSockets(userId);

        let emittedCount = 0;
        for (const socketId of socketIds) {
            const socket = this.connectedClients.get(socketId);
            if (socket) {
                socket.emit(event, data);
                emittedCount++;
            }
        }

        this.logger.debug(`Broadcasted event ${event} to user ${userId} (${emittedCount} sockets)`);
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
     * Get the number of connected users
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

    /**
     * Emit an event to all sockets of a specific user
     */
    emitToUser(userId: string, event: string, data: any): void {
        this.broadcastToUser(userId, event, data);
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
    } {
        const userConnections = Array.from(this.userSockets.entries()).map(([userId, sockets]) => ({
            userId,
            socketCount: sockets.size,
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

    joinRoom(socketId: string, room: string): void {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
            socket.join(room);

            // Track room membership
            if (!this.roomClients.has(room)) {
                this.roomClients.set(room, new Set());
            }
            this.roomClients.get(room)?.add(socketId);

            this.logger.debug(`Socket ${socketId} joined room ${room}`);
        }
    }

    leaveRoom(socketId: string, room: string): void {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
            socket.leave(room);

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

    getRoomClients(room: string): string[] {
        return Array.from(this.roomClients.get(room) || []);
    }

    getRoomCount(room: string): number {
        return this.roomClients.get(room)?.size || 0;
    }
}
