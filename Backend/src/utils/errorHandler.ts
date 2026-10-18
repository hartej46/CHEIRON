import { FastifyError, FastifyRequest, FastifyReply } from "fastify";

const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ err: error }, "unhandled error");
    const statusCode =
        typeof error.statusCode === "number" && error.statusCode >= 400 ? error.statusCode : 500;
    reply.status(500).send({
        statusCode: statusCode,
        error: "Internal Server Error",
        message: "Internal Server Error",
    });
};

export default errorHandler;
