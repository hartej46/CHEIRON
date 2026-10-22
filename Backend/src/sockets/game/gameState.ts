import { Server } from "socket.io";
import { envConfig } from "../../app";
import AppError from "../../utils/error";

export interface PlayerState {
    id: string;
    score: number;
    coordinates: number[] | null;
}

export interface RoomState {
    roomId: string;
    player_1: PlayerState;
    player_2: PlayerState;
    round: number;
    status: "waiting" | "countdown" | "in_progress" | "evaluation" | "finished";
    roundTimeout?: NodeJS.Timeout;
}

export const activeRooms = new Map<string, RoomState>();
export const socketToRoom = new Map<string, string>(); // We use this accidental close ups

export function createGameRoom(
    roomId: string,
    player_1_id: string,
    player_2_id: string
) {
    const room: RoomState = {
        roomId,
        player_1: {
            id: player_1_id,
            score: 0,
            coordinates: null,
        },
        player_2: {
            id: player_2_id,
            score: 0,
            coordinates: null,
        },
        round: 0,
        status: "waiting",
    };

    activeRooms.set(roomId, room);
    socketToRoom.set(player_1_id, roomId);
    socketToRoom.set(player_2_id, roomId);
}

export function startNextRound(roomId: string, io_server: Server) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    room.round += 1;
    room.status = "countdown";

    room.player_1.coordinates = null;
    room.player_2.coordinates = null;

    io_server.to(roomId).emit("round_start", { round: room.round, durationMs: 3000 });

    // safety timeout

    room.roundTimeout = setTimeout(() => {
        if (room.status !== "evaluation") {
            io_server.to(roomId).emit("round_error", { message: "Retrying round" });
            startNextRound(roomId, io_server);
        }
    }, 5000);
}

export async function submitCoordinates(
    roomId: string,
    socketId: string,
    coordinates: number[],
    io_server: Server
) {
    const room = activeRooms.get(roomId);

    if (!room) return;

    if (room.player_1.id === socketId && !room.player_1.coordinates) {
        room.player_1.coordinates = coordinates;
    } else if (room.player_2.id === socketId && !room.player_2.coordinates) {
        room.player_2.coordinates = coordinates;
    }

    if (room.player_1.coordinates && room.player_2.coordinates) {
        room.status = "evaluation";

        if (room.roundTimeout) {
            clearTimeout(room.roundTimeout);
        }

        await evaluateRound(room, io_server);
    }
}

export async function evaluateRound(room: RoomState, io_server: Server) {
    // Here we have to write the python script to evaluate the round and update the scores accordingly. For now, let's just simulate the evaluation.

    try{

        const[p1_respones, p2_response] = await Promise.all([
            fetch(`${(envConfig as any).ML_SERVICE_URL}/predict`, {
                method: "POST",
                headers : {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({coordinates: room.player_1.coordinates})
            }),

            fetch(`${(envConfig as any).ML_SERVICE_URL}/predict`, {
                method: "POST",
                headers : {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({coordinates: room.player_2.coordinates})
            })
        ]);

        if(!p1_respones.ok || !p2_response.ok) {
                throw new AppError("Model server error",502);
            }
        
        const p1_result = await p1_respones.json();
        const p2_result = await p2_response.json();

        const p1_move = p1_result.prediction;
        const p2_move = p2_result.prediction;

        // Calculating the winner based on the predictions

        let roundResult = "Draw"

        // Handle cases where players camera did not detect 

        if(p1_move === "None" && p2_move !== "None") {
            roundResult = "Player 2 Wins";
            // TODO: here we can update the score of player 2 if we want score system
        }

        else if(p2_move === "None" && p1_move !== "None") {
            roundResult = "Player 1 Wins";
            // TODO: here we can update the score of player 1 if we want score system
        }

        else if (p1_move !== "None" && p2_move !== "None") {
            // Standard game logic
            if (
                (p1_move === "Rock" && p2_move === "Scissors") ||
                (p1_move === "Paper" && p2_move === "Rock") ||
                (p1_move === "Scissors" && p2_move === "Paper")
            ) {
                roundResult = "player_1_wins";
                // room.player_1.score += 1;
            } else if (
                (p2_move === "Rock" && p1_move === "Scissors") ||
                (p2_move === "Paper" && p1_move === "Rock") ||
                (p2_move === "Scissors" && p1_move === "Paper")
            ) {
                roundResult = "player_2_wins";
                // room.player_2.score += 1;
            }
        }

        io_server.to(room.roomId).emit(
            "roundResults",
            {
                p1_move,
                p2_move,
                result: roundResult,
                // p1_score: room.player_1.score,
                // p2_score: room.player_2.score,
            }
        )

    } catch (error) {
        console.error("Error during round evaluation:", error);
        io_server.to(room.roomId).emit("round_error", { message: "Error during round evaluation" });
        return;
    }
}
