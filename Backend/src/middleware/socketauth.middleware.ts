import {Socket} from "socket.io";
// import { parse } from "cookie"; This shit aint working
import jwt from "jsonwebtoken";
import AppError from "../utils/error.ts";

interface JwtPayload {
    id: string;
    nickname: string;
}

export const verifySocketToken = (socket: Socket, next: (err?: Error) => void) => {
    try{
        const rawCookie = socket.handshake.headers.cookie;
        if (!rawCookie) {
            return next(new AppError("No cookie found",401));
        }

        // Native regex to extract the JWT token directly from the string
        const match = rawCookie.match(/(?:^|; )jwtToken=([^;]*)/);
        const token = match ? decodeURIComponent(match[1]) : null;

        if (!token) {
            return next(new AppError("JWT token not found in cookie",401));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

        socket.data.playerId = decoded.id;
        socket.data.nickname = decoded.nickname;

        next();

    }catch(err){
        return next(new AppError("Authentication error: Invalid or expired token",401));
    }
}
