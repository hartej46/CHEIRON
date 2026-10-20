import type { FastifyReply } from "fastify";
import { verifyToken } from "../utils/jwtToken.ts";
import AppError from "../utils/error.ts";
import { getUserDetails } from "../memory/user.memory.ts";
import type { AuthFastifyRequest } from "../types/user.types.ts";

export async function authMiddleware(request: AuthFastifyRequest, reply: FastifyReply) {
    const signedToken = request.cookies.jwtToken;

    if (!signedToken) throw new AppError("No user found", 401);
    const user = verifyToken(signedToken);

    if (!user) throw new AppError("No user found", 401);
    const activeUser = getUserDetails(user.id);
    if (!activeUser) throw new AppError("No user found", 401);

    request.user = activeUser;
}
