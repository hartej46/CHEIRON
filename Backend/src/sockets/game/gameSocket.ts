import { Server, Socket } from "socket.io";
import {
    createGameRoom,
    startNextRound,
    submitCoordinates,
    activeRooms,
    socketToRoom,
} from "./gameState";
import { verifySocketToken } from "../../middleware/socketauth.middleware";

const waitingQueue: string[] = [];

export default function registerGameSockets(io_server: Server) {

    io_server.use(verifySocketToken);

    io_server.on("connection", (socket) => {

        const rawCookie = socket.handshake.headers.cookie;
        if (!rawCookie) {
            socket.disconnect();
            return;
        }

        console.log(`Player connected: ${rawCookie}`);

        socket.on("find_match", () => {
            if (waitingQueue.includes(socket.id) || socketToRoom.has(socket.id)) return;

            if (waitingQueue.length > 0) {
                const opponentId = waitingQueue.shift();
                const roomId = `room_${Date.now()}`;

                socket.join(roomId);

                const opponentSocket = io_server.sockets.sockets.get(opponentId!);

                if (opponentSocket) {
                    opponentSocket.join(roomId);
                    createGameRoom(
                        roomId,
                        opponentSocket.id,
                        socket.id,
                        io_server
                    );
                }

                io_server.to(roomId).emit("match_found", { roomId });
            } else {
                waitingQueue.push(socket.id);
                socket.emit("waiting_for_opponent");
            }
        });

        socket.on("disconnect", () => {
            const queueIndex = waitingQueue.indexOf(socket.id);
            if (queueIndex !== -1) {
                waitingQueue.splice(queueIndex, 1);
            }

            const roomId = socketToRoom.get(socket.id);
            if (roomId) {
                io_server.to(roomId).emit("opponent_disconnected");
                const room = activeRooms.get(roomId);

                if (room) {
                    if (room.roundTimeout) {
                        clearTimeout(room.roundTimeout);
                    }
                    socketToRoom.delete(room.player_1.id);
                    socketToRoom.delete(room.player_2.id);
                    activeRooms.delete(roomId);
                }
            }
        });

        // WebRTC signaling events
        socket.on("webrtc_offer", ({ roomId, sdp }) => {
            // fastify.log.info(`Received WebRTC sdp from ${socket.id} for room ${roomId}`);
            socket.to(roomId).emit("webrtc_offer", { sdp });
        });

        socket.on("webrtc_answer", ({ roomId, sdp }) => {
            // fastify.log.info(`Received WebRTC answer from ${socket.id} for room ${roomId}`);
            socket.to(roomId).emit("webrtc_answer", { sdp });
        });

        socket.on("webrtc_ice_candidate", ({ roomId, candidate }) => {
            // fastify.log.info(`Received ICE candidate from ${socket.id} for room ${roomId}`);
            socket.to(roomId).emit("webrtc_ice_candidate", { candidate });
        });

        socket.on("submit_coordinates", ({ roomId, coordinates }) => {
            submitCoordinates(roomId, socket.id, coordinates, io_server);
        });
        // TODO: Both the users can send this incrementing rounds twice
        socket.on("client_ready", ({ roomId }) => {
            startNextRound(roomId, io_server); 
        });
    });
}
