import Fastify from "fastify";
import cors, { autoConfig as CorsAutoConfig } from "./plugins/external/cors.plugin.ts";
import env, { autoConfig as EnvAutoConfig } from "./plugins/external/env.plugin.ts";
import errorHandler from "./utils/errorHandler.ts";

const fastify = Fastify({
    logger: {
        level: "debug",
    },
});

fastify.register(env, EnvAutoConfig);
fastify.register(cors, CorsAutoConfig);

fastify.after(() => {
    fastify.log.level = fastify.config.LOG_LEVEL;
});
fastify.setErrorHandler(errorHandler);
export const envConfig = fastify.config;

export default fastify;
