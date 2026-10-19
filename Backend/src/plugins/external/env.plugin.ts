import env from "@fastify/env";

declare module "fastify" {
    export interface FastifyInstance {
        config: {
            PORT: number;
            LOG_LEVEL: string;
            JWT_TOKEN_SECERT: string;
            JWT_TOKEN_EXPIRY: string;
            PLAYER_DETAILS_DELETE_TIME: number;
        };
    }
}

const envSchema = {
    type: "object",
    required: [],
    properties: {
        PORT: {
            type: "number",
            default: 3000,
        },
        LOG_LEVEL: {
            type: "string",
            default: "debug",
        },
        JWT_TOKEN_SECERT: {
            type: "string",
        },
        JWT_TOKEN_EXPIRY: {
            type: "string",
            default: "1d",
        },
        PLAYER_DETAILS_DELETE_TIME: {
            type: "number",
        },
    },
};

export const autoConfig = {
    confKey: "config",
    schema: envSchema,
    dotenv: true,
};

export default env;
