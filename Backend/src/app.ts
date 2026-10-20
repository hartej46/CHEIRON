import Fastify from "fastify";
import cors, { autoConfig as CorsAutoConfig } from "./plugins/external/cors.plugin.ts";
import env, { autoConfig as EnvAutoConfig } from "./plugins/external/env.plugin.ts";
import errorHandler from "./utils/errorHandler.ts";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { validatorCompiler, serializerCompiler } from "@fastify/type-provider-zod";
import cookie from "@fastify/cookie";
import routes from "./routes/routes.ts";

const fastify = Fastify({
    logger: {
        level: "debug",
    },
}).withTypeProvider<ZodTypeProvider>();

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

await fastify.register(env, EnvAutoConfig);
await fastify.register(cors, CorsAutoConfig);
await fastify.register(cookie);
await fastify.register(routes);

fastify.after(() => {
    fastify.log.level = fastify.config.LOG_LEVEL;
});
fastify.setErrorHandler(errorHandler);
export const envConfig = fastify.config;

export default fastify;
