import env from "@fastify/env";

declare module "fastify" {
    export interface FastifyInstance {
        config: {
            PORT: number;
            LOG_LEVEL: string;
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
    },
};

export const autoConfig = {
    confKey: "config",
    schema: envSchema,
    dotenv: true,
};

export default env;
