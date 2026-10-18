import {Server} from "socket.io";

export interface PlayerState {
    id: string;
    score: number;
    coordinates: number[] | null;
}

export interface RoomState {
    roomId: string;
    player_1 : PlayerState;
    player_2 : PlayerState;
    round : number;
    status: "waiting" | "countdown" |"in_progress" | "evaluation" |"finished";
    roundTimeout?: NodeJS.Timeout ;
}

export const activeRooms = new Map<string, RoomState>();
export const socketToRoom = new Map<string, string>(); // We use this accidental close ups

export function createGameRoom(
    roomId : string, 
    player_1_id : string,
    player_2_id : string,
    io_server : Server,
){
    const room : RoomState = {
        roomId,
        player_1 : {
            id : player_1_id,
            score : 0,
            coordinates : null,
        },
        player_2 : {
            id : player_2_id,
            score : 0,
            coordinates : null,
        },
        round : 1,
        status : "waiting",
    }

    activeRooms.set(roomId, room);
    socketToRoom.set(player_1_id, roomId);
    socketToRoom.set(player_2_id, roomId);

    io_server.to(roomId).emit("match_found", {roomId})

}

export function startNextRound(roomId : string, io_server : Server){

    const room = activeRooms.get(roomId);
    if(!room) return;

    room.round += 1;
    room.status = "countdown";

    room.player_1.coordinates = null;
    room.player_2.coordinates = null;

    io_server.to(roomId).emit("round_start", { round: room.round, durationMs: 3000 });

    // safety timeout 

    room.roundTimeout = setTimeout(() => {
        if(room.status !== "evaluation"){
            io_server.to(roomId).emit("round_error", { message : "Retrying round" });
            startNextRound(roomId, io_server);
        }
    },5000)

}
