import env from "@fastify/env";

declare module "fastify" {
    export interface FastifyInstance {
        config: {
            PORT: number;
            LOG_LEVEL: string;
            JWT_TOKEN_SECERT: string;
            JWT_TOKEN_EXPIRY: string;
            PLAYER_DETAILS_DELETE_TIME: number;
            FRONTEND_URL: string;
            ML_SERVICE_URL: string;
            CLOUDFLARE_TURN_KEY_ID?: string;
            CLOUDFLARE_TURN_API_TOKEN?: string;
            METERED_APP_NAME?: string;
            METERED_API_KEY?: string;
            TURN_URLS?: string;
            TURN_USERNAME?: string;
            TURN_CREDENTIAL?: string;
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
        FRONTEND_URL: {
            type: "string",
            default: "http://localhost:5173",
        },
        ML_SERVICE_URL: {
            type: "string",
            default: "http://localhost:8000",
        },
        CLOUDFLARE_TURN_KEY_ID: {
            type: "string",
            default: "",
        },
        CLOUDFLARE_TURN_API_TOKEN: {
            type: "string",
            default: "",
        },
        METERED_APP_NAME: {
            type: "string",
            default: "",
        },
        METERED_API_KEY: {
            type: "string",
            default: "",
        },
        TURN_URLS: {
            type: "string",
            default: "",
        },
        TURN_USERNAME: {
            type: "string",
            default: "",
        },
        TURN_CREDENTIAL: {
            type: "string",
            default: "",
        },
    },
};

export const autoConfig = {
    confKey: "config",
    schema: envSchema,
    dotenv: true,
};

export default env;
