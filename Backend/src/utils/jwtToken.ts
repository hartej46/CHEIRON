import jwt from "jsonwebtoken";
import { UserSession } from "../types/user.types";
import { envConfig } from "../app.ts";

/**
 * Generates a JWT access token for the user.
 * @param userDetails - The user's details used to generate the token.
 * @returns The generated JWT token.
 */
export const generateToken = (userDetails: UserSession) => {
    const token = jwt.sign(
        userDetails,
        envConfig.JWT_TOKEN_SECERT,
        {
        expiresIn: userDetails.expiresAt,
        });

    return token;
};
