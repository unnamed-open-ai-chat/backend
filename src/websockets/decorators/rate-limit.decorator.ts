import { Socket } from 'socket.io';

// Rate limiter storage
const rateLimits = new Map<string, { count: number; resetTime: number }>();

export function RateLimit(maxRequests: number, windowSeconds: number) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const client: Socket = args[0];
            const key = `${client.id}:${propertyKey}`;

            // Get current time
            const now = Date.now();

            // Get or create rate limit entry
            let limitData = rateLimits.get(key);
            if (!limitData || now > limitData.resetTime) {
                // Reset if window expired
                limitData = {
                    count: 0,
                    resetTime: now + windowSeconds * 1000,
                };
            }

            // Check if limit exceeded
            if (limitData.count >= maxRequests) {
                client.emit('error', {
                    message: 'Rate limit exceeded. Please try again later.',
                    event: propertyKey,
                });
                return;
            }

            // Increment counter
            limitData.count++;
            rateLimits.set(key, limitData);

            // Call original method
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}
