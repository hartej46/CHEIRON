import Fastify from "fastify";
import cors, { autoConfig as CorsAutoConfig } from "./plugins/external/cors.plugin.ts";
import env, { autoConfig as EnvAutoConfig } from "./plugins/external/env.plugin.ts";

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

export default fastify;
