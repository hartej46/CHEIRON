import { FastifyError, FastifyRequest, FastifyReply } from "fastify";

const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ err: error }, "unhandled error");
    const errorWithStatus = error as FastifyError & { status?: unknown };
    const statusCode =
        typeof error.statusCode === "number" && error.statusCode >= 400
            ? error.statusCode
            : typeof errorWithStatus.status === "number" && errorWithStatus.status >= 400
                ? errorWithStatus.status
                : 500;
    reply.status(statusCode).send({
        statusCode: statusCode,
        error: "Internal Server Error",
        message: "Internal Server Error",
    });
};

export default errorHandler;
