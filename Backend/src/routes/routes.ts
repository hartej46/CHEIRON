import type { FastifyPluginAsync } from "fastify";
import { deletePlayer, getPlayerDetails, initPlayer } from "../controller/user.controller.ts";
import { authMiddleware } from "../middleware/auth.middleware.ts";
import { InitSessionBodySchema } from "../schema/user.schema.ts";

const routes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/", async () => ({
        success: true,
        message: "Cheiron backend is running",
    }));

    fastify.get("/health", async () => ({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: Date.now(),
    }));

    fastify.post(
        "/session/init",
        {
            schema: {
                body: InitSessionBodySchema,
            },
        },
        initPlayer
    );

    fastify.get(
        "/session/me",
        {
            preHandler: authMiddleware,
        },
        getPlayerDetails
    );

    fastify.post(
        "/session/clear",
        {
            preHandler: authMiddleware,
        },
        deletePlayer
    );
};

export default routes;
