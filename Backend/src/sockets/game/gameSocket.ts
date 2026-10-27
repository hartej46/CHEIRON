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

        console.log(`Player connected: socketId=${socket.id}, nickname=${socket.data.nickname}`);

        socket.on("find_match", () => {
            console.log(`[MATCHMAKING] 'find_match' received from ${socket.id} (${socket.data.nickname})`);
            if (waitingQueue.includes(socket.id) || socketToRoom.has(socket.id)) {
                console.log(`[MATCHMAKING] Socket ${socket.id} already in queue or room`);
                return;
            }

            // Filter out any stale, disconnected, or busy sockets from the queue
            const availableQueue = waitingQueue.filter((id) => {
                const s = io_server.sockets.sockets.get(id);
                return s?.connected && !socketToRoom.has(id) && id !== socket.id;
            });

            // Random matchmaking: pick a random opponent from the available queue
            let opponentId: string | undefined;
            let opponentSocket: Socket | undefined;

            if (availableQueue.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableQueue.length);
                opponentId = availableQueue[randomIndex];
                opponentSocket = io_server.sockets.sockets.get(opponentId);

                // Remove the chosen opponent from waitingQueue
                const qIdx = waitingQueue.indexOf(opponentId);
                if (qIdx !== -1) waitingQueue.splice(qIdx, 1);
            }

            if (opponentSocket && opponentId) {
                const roomId = `room_${Date.now()}`;
                console.log(`[MATCHMAKING] Match created! Room: ${roomId} between ${socket.id} and ${opponentId}`);

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
                console.log(`[MATCHMAKING] Socket ${socket.id} added to waitingQueue. Queue length: ${waitingQueue.length}`);
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

        socket.on(
            "submit_coordinates",
            ({ roomId, coordinates }: { roomId: string; coordinates: number[][] }) => {
                void submitCoordinates(roomId, socket.id, coordinates, io_server);
            }
        );
        // TODO: Both the users can send this incrementing rounds twice
        socket.on("client_ready", ({ roomId }) => {
            startNextRound(roomId, io_server); 
        });
    });
}
