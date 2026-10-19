import jwt from "jsonwebtoken";
import { UserSession } from "../types/user.types.ts";
import { getEnvConfig } from "../app.ts";

/**
 * Generates a JWT access token for the user.
 * @param userDetails - The user's details used to generate the token.
 * @returns The generated JWT token.
 */
export const generateToken = (userDetails: UserSession) => {
    const token = jwt.sign(
        {
            id: userDetails.id,
            nickname: userDetails.nickname,
            initiatedAt: userDetails.initiatedAt,
            expiresAt: userDetails.expiresAt,
        },
        getEnvConfig().JWT_TOKEN_SECERT,
        {
            expiresIn: Math.max(1, Math.floor((userDetails.expiresAt - Date.now()) / 1000)),
        }
    );

    return token;
};

/**
 *
 * @param token - JWT token from user
 * @returns The decode payload or null
 */
export const verifyToken = (token: string): UserSession | null => {
    try {
        const userDetails = jwt.verify(token, getEnvConfig().JWT_TOKEN_SECERT);
        return userDetails as UserSession;
    } catch (error: unknown) {
        return null;
    }
};
