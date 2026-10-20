import { addNewPlayer, deleteUser } from "../memory/user.memory.ts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { InitSessionBodySchema } from "../schema/user.schema.ts";
import AppError from "../utils/error.ts";
import { randomUUID } from "crypto";
import { envConfig } from "../app.ts";
import { generateToken } from "../utils/jwtToken.ts";
import { jwtTokenOptions } from "../constants.ts";
import type { AuthFastifyRequest } from "../types/user.types.ts";

export const initPlayer = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = InitSessionBodySchema.safeParse(request.body);
    if (!result.success) {
        throw new AppError("The input given is invalid", 400);
    }

    const id = randomUUID();
    const nickname = result.data.nickname || "Harry Putter";
    const intiatedAt = Date.now();
    const expiresAt = intiatedAt + envConfig.PLAYER_DETAILS_DELETE_TIME;

    const newPlayer = addNewPlayer(id, nickname, intiatedAt, expiresAt);

    const token = generateToken(newPlayer);

    reply.setCookie("jwtToken", token, jwtTokenOptions);
    return reply.status(201).send({
        success: true,
        profile: {
            id: newPlayer.id,
            nickname: newPlayer.nickname,
            initiatedAt: newPlayer.initiatedAt,
            expiresAt: newPlayer.expiresAt,
        },
        message: "Player added successfully",
    });
};

export const getPlayerDetails = async (request: AuthFastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) throw new AppError("No user found", 401);

    return reply.status(200).send({
        success: true,
        profile: {
            id: user.id,
            nickname: user.nickname,
            initiatedAt: user.initiatedAt,
            expiresAt: user.expiresAt,
        },
    });
};

export const deletePlayer = async (request: AuthFastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const isDeleted = deleteUser(user?.id);

    if (!isDeleted)
        return reply.status(404).send({
            success: false,
            message: "User doesn't exist",
        });

    reply.clearCookie("jwtToken", jwtTokenOptions);
    return reply.status(200).send({
        success: true,
        message: "successfully deleted user",
    });
};
