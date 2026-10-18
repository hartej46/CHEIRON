import { FastifyRequest, FastifyReply } from 'fastify'

const errorHandler = (error: any, req: FastifyRequest, res: FastifyReply) => {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).send({
        success: false,
        message: error.message || "Something went wrong",
    });
};

export default errorHandler;