/**
 * Type for userdetail stored in memory map 
 */
export interface UserSession {
    id: string;
    initiatedAt: number;
    expiresAt: number;
    expiryTimer: ReturnType<typeof setTimeout>;      //id for setTimeout for specific user
}