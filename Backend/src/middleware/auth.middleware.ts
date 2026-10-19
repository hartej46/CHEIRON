import { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "../utils/jwtToken";
import AppError from "../utils/error";
import { AuthFastifyRequest } from "../types/user.types";

async function authMiddleware(request: AuthFastifyRequest, reply: FastifyReply) {
    const signedToken = request.cookies.jwtToken;

    if (!signedToken) throw new AppError("No user found", 401);
    const user = verifyToken(signedToken);

    if (!user) throw new AppError("No user found", 401);
    request.user = user; // Adds user so can be used afterwards
}
