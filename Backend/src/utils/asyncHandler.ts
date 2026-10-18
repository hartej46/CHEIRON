import { FastifyRequest, FastifyReply, RouteHandlerMethod } from "fastify";

const asyncHandler = (fn: RouteHandlerMethod): RouteHandlerMethod => {
    return async function (this: any, req, reply) {
        try {
            return await fn.call(this, req, reply);
        } catch (error: any) {
            const statusCode = error.statusCode || error.status || 500;

            return reply.status(statusCode).send({
                success: false,
                message: error.message || "Something went wrong",
            });
        }
    };
};

export default asyncHandler;