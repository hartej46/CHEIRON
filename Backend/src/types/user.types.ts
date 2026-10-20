import type { FastifyRequest } from "fastify";

/**
 * Type for userdetail stored in memory map
 */
export interface UserSession {
    id: string;
    nickname: string;
    initiatedAt: number;
    expiresAt: number;
    expiryTimer: ReturnType<typeof setTimeout>; //id for setTimeout for specific user
}

export interface AuthFastifyRequest extends FastifyRequest {
    user?: UserSession;
}
