import { Server as SocketIOServer } from "socket.io";
import registerGameSockets from "./sockets/game/gameSocket";
import fastify from "./app.ts";

// Intiate Socket.IO server
const io_server = new SocketIOServer(fastify.server, {
    cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
}
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
