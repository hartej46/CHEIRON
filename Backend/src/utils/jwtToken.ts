import jwt from "jsonwebtoken";
import { UserSession } from "../types/user.types";
import { envConfig } from "../app.ts";

/**
 * Generates a JWT access token for the user.
 * @param userDetails - The user's details used to generate the token.
 * @returns The generated JWT token.
 */
export const generateToken = (userDetails: UserSession) => {
    const token = jwt.sign(userDetails, envConfig.JWT_TOKEN_SECERT, {
        expiresIn: userDetails.expiresAt,
    });

    return token;
};

/**
 *
 * @param token - JWT token from user
 * @returns The decode payload or null
 */
export const verifyToken = (token: string): UserSession | null => {
    try {
        const userDetails = jwt.verify(token, envConfig.JWT_TOKEN_SECERT);
        return userDetails as UserSession;
    } catch (error: unknown) {
        return null;
    }
};
