import { Server, Socket } from "socket.io";
import {
    createGameRoom,
    startNextRound,
    submitCoordinates,
    activeRooms,
    socketToRoom,
} from "./gameState.ts";
import { verifySocketToken } from "../../middleware/socketauth.middleware.ts";

const waitingQueue: string[] = [];

export default function registerGameSockets(io_server: Server) {

    io_server.use(verifySocketToken);

    io_server.on("connection", (socket) => {
        const removeFromWaitingQueue = () => {
            const queueIndex = waitingQueue.indexOf(socket.id);
            if (queueIndex !== -1) {
                waitingQueue.splice(queueIndex, 1);
            }
        };

        const cleanupRoom = (notifyOpponent: boolean) => {
            const roomId = socketToRoom.get(socket.id);
            if (!roomId) {
                removeFromWaitingQueue();
                return;
            }

            const room = activeRooms.get(roomId);
            const opponentId = room
                ? room.player_1.id === socket.id
                    ? room.player_2.id
                    : room.player_1.id
                : undefined;
            const opponentSocket = opponentId
                ? io_server.sockets.sockets.get(opponentId)
                : undefined;

            if (room?.roundTimeout) {
                clearTimeout(room.roundTimeout);
            }

            activeRooms.delete(roomId);
            socketToRoom.delete(socket.id);
            if (opponentId) {
                socketToRoom.delete(opponentId);
            }

            socket.leave(roomId);
            if (opponentSocket) {
                opponentSocket.leave(roomId);
                if (notifyOpponent) {
                    opponentSocket.emit("opponent_disconnected");
                }
            }
        };

        const rawCookie = socket.handshake.headers.cookie;
        if (!rawCookie) {
            socket.disconnect();
            return;
        }

        console.log(`Player connected: ${rawCookie}`);

        socket.on("find_match", () => {
            if (waitingQueue.includes(socket.id) || socketToRoom.has(socket.id)) return;

            let opponentId: string | undefined;
            let opponentSocket: Socket | undefined;
            while (waitingQueue.length > 0) {
                const queuedSocketId = waitingQueue.shift();
                const queuedSocket = queuedSocketId
                    ? io_server.sockets.sockets.get(queuedSocketId)
                    : undefined;
                if (queuedSocket?.connected && !socketToRoom.has(queuedSocket.id)) {
                    opponentId = queuedSocket.id;
                    opponentSocket = queuedSocket;
                    break;
                }
            }

            if (opponentSocket && opponentId) {
                const roomId = `room_${Date.now()}`;

                socket.join(roomId);

                opponentSocket.join(roomId);
                createGameRoom(roomId, opponentId, socket.id);

                opponentSocket.emit("match_found", {
                    roomId,
                    initiator: true,
                    opponentNickname: socket.data.nickname,
                });
                socket.emit("match_found", {
                    roomId,
                    initiator: false,
                    opponentNickname: opponentSocket?.data.nickname,
                });
            } else {
                waitingQueue.push(socket.id);
                socket.emit("waiting_for_opponent");
            }
        });

        socket.on("disconnect", () => {
            cleanupRoom(true);
        });

        socket.on("leave_room", () => {
            cleanupRoom(true);
        });

        // WebRTC signaling events
        socket.on("webrtc_offer", ({ roomId, sdp }) => {
            // fastify.log.info(`Received WebRTC sdp from ${socket.id} for room ${roomId}`);
            socket.to(roomId).emit("webrtc_offer", { roomId, sdp });
        });

        socket.on("webrtc_answer", ({ roomId, sdp }) => {
            // fastify.log.info(`Received WebRTC answer from ${socket.id} for room ${roomId}`);
            socket.to(roomId).emit("webrtc_answer", { roomId, sdp });
        });

        socket.on("webrtc_ice_candidate", ({ roomId, candidate }) => {
            // fastify.log.info(`Received ICE candidate from ${socket.id} for room ${roomId}`);
            socket.to(roomId).emit("webrtc_ice_candidate", { roomId, candidate });
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
