import { CookieSerializeOptions } from "@fastify/cookie";

/**
 * cookie option for jwt token
 */
export const jwtTokenOptions : CookieSerializeOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
};