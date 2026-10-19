import Fastify from "fastify";
import cors, { autoConfig as CorsAutoConfig } from "./plugins/external/cors.plugin.ts";
import env, { autoConfig as EnvAutoConfig } from "./plugins/external/env.plugin.ts";
import errorHandler from "./utils/errorHandler.ts";
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from "@fastify/type-provider-zod";

const fastify = Fastify({
    logger: {
        level: "debug",
    },
}).withTypeProvider<ZodTypeProvider>();

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

fastify.register(env, EnvAutoConfig);
fastify.register(cors, CorsAutoConfig);

fastify.after(() => {
    fastify.log.level = fastify.config.LOG_LEVEL;
});
fastify.setErrorHandler(errorHandler);
export const envConfig = fastify.config;

export default fastify;
