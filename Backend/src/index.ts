import Fastify from "fastify";
import { Server as SocketIOServer } from "socket.io";

// Intiate Fastify server
const fastify = Fastify({
    logger: true,
});

// Intiate Socket.IO server
const io_server = new SocketIOServer(fastify.server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const waitingQueue: string[] = [];

// listen for socket connections
io_server.on("connection", (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);

    socket.on("find_match", () => {
        if (waitingQueue.includes(socket.id)) return;

        if (waitingQueue.length > 0) {
            const opponentId = waitingQueue.shift();
            const roomId = `room_${Date.now()}`;

            socket.join(roomId);

            const opponentSocket = io_server.sockets.sockets.get(opponentId!);

            if (opponentSocket) {
                opponentSocket.join(roomId);
            }

            io_server.to(roomId).emit("match_found", { roomId });
            fastify.log.info(`Paired ${opponentId} and ${socket.id} in ${roomId}`);
        } else {
            waitingQueue.push(socket.id);
            socket.emit("waiting_for_opponent");
            fastify.log.info(`Socket ${socket.id} added to waiting queue`);
        }
    });

    socket.on("disconnect", () => {
        fastify.log.info(`Socket disconnected: ${socket.id}`);

        const queueIndex = waitingQueue.indexOf(socket.id);
        if (queueIndex !== -1) {
            waitingQueue.splice(queueIndex, 1);
        }
    });

    // WebRTC signaling events
    socket.on("webrtc_offer", ({roomId, sdp}) => {

        fastify.log.info(`Received WebRTC sdp from ${socket.id} for room ${roomId}`);
        socket.to(roomId).emit("webrtc_offer", { sdp});

    });

    socket.on("webrtc_answer", ({roomId, sdp}) => {

        fastify.log.info(`Received WebRTC answer from ${socket.id} for room ${roomId}`);
        socket.to(roomId).emit("webrtc_answer", { sdp});

    });

    socket.on("webrtc_ice_candidate", ({roomId, candidate}) => {

        fastify.log.info(`Received ICE candidate from ${socket.id} for room ${roomId}`);
        socket.to(roomId).emit("webrtc_ice_candidate", { candidate});

    });
});

// Handling Shutdown signals
const shutdown = async () => {
    fastify.log.info("Shutting down server...");
    io_server.local.disconnectSockets(true);
    process.exit(0);
};

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: "0.0.0.0" });
    } catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
};

start();
