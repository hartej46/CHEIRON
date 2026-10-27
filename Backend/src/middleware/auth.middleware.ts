import type { FastifyReply } from "fastify";
import { verifyToken } from "../utils/jwtToken.ts";
import AppError from "../utils/error.ts";
import { addNewPlayer, getUserDetails } from "../memory/user.memory.ts";
import type { AuthFastifyRequest } from "../types/user.types.ts";

export async function authMiddleware(request: AuthFastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const signedToken = request.cookies.jwtToken || headerToken;

    if (!signedToken) throw new AppError("No user found", 401);
    const user = verifyToken(signedToken);

    if (!user) throw new AppError("No user found", 401);
    let activeUser = getUserDetails(user.id);
    if (!activeUser) {
        if (user.expiresAt && Date.now() < user.expiresAt) {
            activeUser = addNewPlayer(user.id, user.nickname, user.initiatedAt, user.expiresAt);
        } else {
            throw new AppError("No user found", 401);
        }
    }

    request.user = activeUser;
}
