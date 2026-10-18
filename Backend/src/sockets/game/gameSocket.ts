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
    statue : "waiting" | "countdown" |"in_progress" | "evaluation" |"finished";
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
        
    }
}