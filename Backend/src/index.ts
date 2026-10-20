import { Server as SocketIOServer } from "socket.io";
import registerGameSockets from "./sockets/game/gameSocket.ts";
import fastify from "./app.ts";

// Intiate Socket.IO server
const io_server = new SocketIOServer(fastify.server, {
    cors: {
        origin: (origin, callback) => {
            if (
                !origin ||
                origin === process.env.FRONTEND_URL ||
                /^http:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
            ) {
                callback(null, true);
                return;
            }

            callback(new Error("Not allowed by Socket.IO CORS"), false);
        },
        methods: ["GET", "POST"],
        credentials: true,
    },
});

registerGameSockets(io_server);

// Handling Shutdown signals
const shutdown = async () => {
    fastify.log.info("Shutting down server...");
    io_server.local.disconnectSockets(true);
    process.exit(0);
};

const start = async () => {
    try {
        await fastify.ready();
        await fastify.listen({
            port: fastify.config.PORT,
            host: "0.0.0.0",
        });
    } catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
};

start();
