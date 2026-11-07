import { Server } from "socket.io";
import { envConfig } from "../../app";
import AppError from "../../utils/error";

export interface PlayerState {
    id: string;
    score: number;
    coordinates: number[][] | null;
    isReady?: boolean;
}

export interface RoomState {
    roomId: string;
    player_1: PlayerState;
    player_2: PlayerState;
    round: number;
    status: "waiting" | "countdown" | "in_progress" | "evaluation" | "round_break" | "finished";
    roundTimeout?: NodeJS.Timeout;
    warmupTimeout?: NodeJS.Timeout;
    blindTimeout?: NodeJS.Timeout;
    breakTimeout?: NodeJS.Timeout;
}

export const MAX_ROUNDS = 5;
export const ROUND_DURATION_MS = 5000;
export const BLIND_PHASE_MS = 3500;
export const BREAK_BUFFER_MS = 5000; // 5-second buffer between rounds

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

export function finishMatch(room: RoomState, io_server: Server) {
    room.status = "finished";

    if (room.roundTimeout) {
        clearTimeout(room.roundTimeout);
        room.roundTimeout = undefined;
    }
    if (room.warmupTimeout) {
        clearTimeout(room.warmupTimeout);
        room.warmupTimeout = undefined;
    }
    if (room.blindTimeout) {
        clearTimeout(room.blindTimeout);
        room.blindTimeout = undefined;
    }
    if (room.breakTimeout) {
        clearTimeout(room.breakTimeout);
        room.breakTimeout = undefined;
    }

    let match_winner = "draw";
    if (room.player_1.score > room.player_2.score) {
        match_winner = "player_1";
    } else if (room.player_2.score > room.player_1.score) {
        match_winner = "player_2";
    }

    io_server.to(room.roomId).emit("match_finished", {
        winner: match_winner,
        p1_score: room.player_1.score,
        p2_score: room.player_2.score,
        totalRounds: room.round,
    });

    // Clean up the room after the match is finished
    activeRooms.delete(room.roomId);
    socketToRoom.delete(room.player_1.id);
    socketToRoom.delete(room.player_2.id);
}

export function startNextRound(roomId: string, io_server: Server) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    if (room.roundTimeout) {
        clearTimeout(room.roundTimeout);
        room.roundTimeout = undefined;
    }
    if (room.blindTimeout) {
        clearTimeout(room.blindTimeout);
        room.blindTimeout = undefined;
    }
    if (room.breakTimeout) {
        clearTimeout(room.breakTimeout);
        room.breakTimeout = undefined;
    }

    if (room.round >= MAX_ROUNDS) {
        finishMatch(room, io_server);
        return;
    }

    room.round += 1;
    room.status = "in_progress";

    room.player_1.coordinates = null;
    room.player_2.coordinates = null;

    io_server.to(roomId).emit("round_start", {
        round: room.round,
        maxRounds: MAX_ROUNDS,
        durationMs: ROUND_DURATION_MS,
        blindAfterMs: BLIND_PHASE_MS,
    });

    // Server-coordinated blind phase: at 3.5s, signal both clients to black remote view
    room.blindTimeout = setTimeout(() => {
        const current = activeRooms.get(roomId);
        if (current && current.status === "in_progress" && current.round === room.round) {
            io_server.to(roomId).emit("round_blind_phase", { round: room.round });
        }
    }, BLIND_PHASE_MS);

    // Safety timeout: 5s round + 2.5s network grace
    room.roundTimeout = setTimeout(() => {
        const current = activeRooms.get(roomId);
        if (current && current.status === "in_progress" && current.round === room.round) {
            if (current.round >= MAX_ROUNDS) {
                finishMatch(current, io_server);
                return;
            }
            io_server.to(roomId).emit("round_error", { message: "Round timed out, retrying..." });
            startNextRound(roomId, io_server);
        }
    }, ROUND_DURATION_MS + 2500);
}

export async function submitCoordinates(
    roomId: string,
    socketId: string,
    coordinates: number[][],
    io_server: Server
) {
    const room = activeRooms.get(roomId);

    if (!room) return;

    if (
        !Array.isArray(coordinates) ||
        coordinates.some(
            (sample) =>
                !Array.isArray(sample) ||
                sample.length !== 63 ||
                sample.some((value) => !Number.isFinite(value))
        )
    ) {
        console.error("Rejected invalid coordinate batch.", {
            roomId,
            socketId,
        });
        return;
    }

    // Pad samples up to 5 if player provided 1 to 4 samples
    const finalCoordinates = [...coordinates];
    if (finalCoordinates.length > 0 && finalCoordinates.length < 5) {
        while (finalCoordinates.length < 5) {
            finalCoordinates.push([...finalCoordinates[finalCoordinates.length - 1]]);
        }
    }

    if (room.player_1.id === socketId && !room.player_1.coordinates) {
        room.player_1.coordinates = finalCoordinates;
    } else if (room.player_2.id === socketId && !room.player_2.coordinates) {
        room.player_2.coordinates = finalCoordinates;
    }

    if (room.player_1.coordinates && room.player_2.coordinates) {
        room.status = "evaluation";

        if (room.roundTimeout) {
            clearTimeout(room.roundTimeout);
            room.roundTimeout = undefined;
        }
        if (room.blindTimeout) {
            clearTimeout(room.blindTimeout);
            room.blindTimeout = undefined;
        }

        await evaluateRound(room, io_server);
    }
}

export interface RoundEvaluation {
    winner: "player_1" | "player_2" | "draw";
    result: "player_1_wins" | "player_2_wins" | "draw";
    reason: string;
}

/**
 * Evaluates round moves returned from the Python engine
 */
export function evaluateMoves(p1_raw_move: string, p2_raw_move: string): RoundEvaluation {
    const p1 = (p1_raw_move || "none").toLowerCase().trim();
    const p2 = (p2_raw_move || "none").toLowerCase().trim();

    // Case 1: Both failed to show a recognizable gesture
    if (p1 === "none" && p2 === "none") {
        return {
            winner: "draw",
            result: "draw",
            reason: "Neither player showed a clear hand gesture",
        };
    }

    // Case 2: Only player 1 showed a recognizable gesture
    if (p1 !== "none" && p2 === "none") {
        return {
            winner: "player_1",
            result: "player_1_wins",
            reason: `Player 1 wins with ${p1} (Player 2 not detected)`,
        };
    }

    // Case 3: Only player 2 showed a recognizable gesture
    if (p1 === "none" && p2 !== "none") {
        return {
            winner: "player_2",
            result: "player_2_wins",
            reason: `Player 2 wins with ${p2} (Player 1 not detected)`,
        };
    }

    // Case 4: Both players chose the same gesture
    if (p1 === p2) {
        return {
            winner: "draw",
            result: "draw",
            reason: `Draw! Both players chose ${p1}`,
        };
    }

    // Case 5: Standard Rock-Paper-Scissors rules
    const p1Wins =
        (p1 === "rock" && p2 === "scissors") ||
        (p1 === "paper" && p2 === "rock") ||
        (p1 === "scissors" && p2 === "paper");

    if (p1Wins) {
        return {
            winner: "player_1",
            result: "player_1_wins",
            reason: `${p1.toUpperCase()} beats ${p2.toUpperCase()}`,
        };
    } else {
        return {
            winner: "player_2",
            result: "player_2_wins",
            reason: `${p2.toUpperCase()} beats ${p1.toUpperCase()}`,
        };
    }
}

export async function evaluateRound(room: RoomState, io_server: Server) {
    // Here we have to write the python script to evaluate the round and update the scores accordingly. For now, let's just simulate the evaluation.

    try{

        const player1Coordinates = room.player_1.coordinates ?? [];
        const player2Coordinates = room.player_2.coordinates ?? [];

        const mlBaseUrl = String((envConfig as any).ML_SERVICE_URL || "http://localhost:8000").replace(/\/+$/, "");
        const[p1_respones, p2_response] = await Promise.all([
            fetch(`${mlBaseUrl}/predict`, {
                method: "POST",
                headers : {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({coordinates: player1Coordinates})
            }),

            fetch(`${mlBaseUrl}/predict`, {
                method: "POST",
                headers : {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({coordinates: player2Coordinates})
            })
        ]);

        if(!p1_respones.ok || !p2_response.ok) {
                throw new AppError("Model server error",502);
            }
        
        const p1_result = await p1_respones.json();
        const p2_result = await p2_response.json();

        const p1_move = p1_result?.success ? p1_result.prediction : "None";
        const p2_move = p2_result?.success ? p2_result.prediction : "None";
            
        const evaluation = evaluateMoves(p1_move, p2_move);

        if (evaluation.winner === "player_1") {
            room.player_1.score += 1;
        } else if (evaluation.winner === "player_2") {
            room.player_2.score += 1;
        }

        room.status = "round_break";

        io_server.to(room.roomId).emit(
            "roundResults",
            {
                round: room.round,
                maxRounds: MAX_ROUNDS,
                p1_move,
                p2_move,
                winner: evaluation.winner,
                result: evaluation.result,
                reason: evaluation.reason,
                p1_score: room.player_1.score,
                p2_score: room.player_2.score,
                p1_id: room.player_1.id,
                p2_id: room.player_2.id,
                nextRoundIn: Math.round(BREAK_BUFFER_MS / 1000),
                isFinalRound: room.round >= MAX_ROUNDS,
            }
        );

        if (room.round >= MAX_ROUNDS) {
            // Buffer of 5 seconds to celebrate/view round 5 results, then finish the match
            room.breakTimeout = setTimeout(() => {
                finishMatch(room, io_server);
            }, BREAK_BUFFER_MS);
        } else {
            // 5 second buffer before starting the next round
            room.breakTimeout = setTimeout(() => {
                const current = activeRooms.get(room.roomId);
                if (current && current.status === "round_break") {
                    startNextRound(room.roomId, io_server);
                }
            }, BREAK_BUFFER_MS);
        }

    } catch (error) {
        console.error("Error during round evaluation:", error);
        io_server.to(room.roomId).emit("round_error", { message: "Error during round evaluation" });
        return;
    }
}
