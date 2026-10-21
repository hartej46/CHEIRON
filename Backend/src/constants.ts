import type { CookieSerializeOptions } from "@fastify/cookie";

/**
 * cookie option for jwt token
 */
export const jwtTokenOptions: CookieSerializeOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
};
