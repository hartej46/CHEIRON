import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || "debug"
    }
});

fastify.register(cors);