import {Socket} from "socket.io";
// import { parse } from "cookie"; This shit aint working
import jwt from "jsonwebtoken";

interface JwtPayload {
    id: string;
    nickname: string;
}

export const verifySocketToken = (socket: Socket, next: (err?: Error) => void) => {
    try{
        const rawCookie = socket.handshake.headers.cookie;
        if (!rawCookie) {
            return next(new Error("No cookie found"));
        }

        // Native regex to extract the JWT token directly from the string
        const match = rawCookie.match(/(?:^|; )jwtToken=([^;]*)/);
        const token = match ? decodeURIComponent(match[1]) : null;

        if (!token) {
            return next(new Error("JWT token not found in cookie"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

        socket.data.playerId = decoded.id;
        socket.data.nickname = decoded.nickname;

        next();

    }catch(err){
        next(new Error("Authentication error: Invalid or expired token"));
    }
}
