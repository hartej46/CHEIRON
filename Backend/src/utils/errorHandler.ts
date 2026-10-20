import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";

const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ err: error }, "unhandled error");
    const errorWithStatus = error as FastifyError & { status?: unknown };
    const statusCode =
        typeof error.statusCode === "number" && error.statusCode >= 400
            ? error.statusCode
            : typeof errorWithStatus.status === "number" && errorWithStatus.status >= 400
                ? (errorWithStatus.status as number)
                : 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    const message = isClientError ? error.message : "Internal Server Error";
    const errorName = isClientError ? error.name || "Bad Request" : "Internal Server Error";

    reply.status(statusCode).send({
        statusCode: statusCode,
        error: errorName,
        message: message,
    });
};

export default errorHandler;
