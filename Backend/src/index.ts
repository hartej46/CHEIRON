import Fastify from "fastify";
import { Server as SocketIOServer } from "socket.io";

// Intiate Fastify server
const fastify = Fastify({
    logger: true,
})

// Intiate Socket.IO server
const io_server = new SocketIOServer(fastify.server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// listen for socket connections
io_server.on("connection" , (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);

    socket.on("disconnect" , () => {
        fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
});

// Handling Shutdown signals
const shutdown = async () => {
    fastify.log.info("Shutting down server...");
    io_server.local.disconnectSockets(true);
    process.exit(0);
}

const start = async () => {

    try {
        await fastify.listen({ port: 3000, host: "0.0.0.0" });
    } catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
}

start();
