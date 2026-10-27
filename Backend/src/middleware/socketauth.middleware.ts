import {Socket} from "socket.io";
// import { parse } from "cookie"; This shit aint working
import jwt from "jsonwebtoken";
import AppError from "../utils/error.ts";
import { envConfig } from "../app.ts";

interface JwtPayload {
    id: string;
    nickname: string;
}

export const verifySocketToken = (socket: Socket, next: (err?: Error) => void) => {
    try {
        const rawCookie = socket.handshake.headers.cookie;
        const cookieMatch = rawCookie?.match(/(?:^|; )jwtToken=([^;]*)/);
        const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
        const authToken = (socket.handshake.auth?.token as string | undefined) || null;
        const token = authToken || cookieToken;

        if (!token) {
            return next(new AppError("No authentication token found", 401));
        }

        const decoded = jwt.verify(token, envConfig.JWT_TOKEN_SECERT) as JwtPayload;

        socket.data.playerId = decoded.id;
        socket.data.nickname = decoded.nickname;

        next();

    }catch(err){
        return next(new AppError("Authentication error: Invalid or expired token",401));
    }
}
