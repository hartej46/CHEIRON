import cors from "@fastify/cors";
import type { FastifyCorsOptions } from "@fastify/cors";

export const autoConfig: FastifyCorsOptions = {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
        if (
            origin === allowedOrigin ||
            /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)
        ) {
            return cb(null, true);
        }
        return cb(new Error("Not allowed by CORS"), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
};
export default cors;
