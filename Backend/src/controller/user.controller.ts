import { addNewPlayer, getUserDetails, deleteUser } from "../memory/user.memory.ts";
import { FastifyReply, FastifyRequest } from "fastify";
import { InitSessionBodySchema } from "../schema/user.schema.ts";
import AppError from "../utils/error.ts";
import { randomUUID } from "crypto";
import { envConfig } from "../app.ts";
import { generateToken } from "../utils/jwtToken.ts";
import { jwtTokenOptions } from "../constants.ts";
import { AuthFastifyRequest } from "../types/user.types.ts";

const initPlayer = async (request: FastifyRequest, reply: FastifyReply) => {
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
        sucess: true,
        message: "Player added successfully",
    });
};

const getPlayerDetails = async (request: AuthFastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    return reply.status(201).send(user);
};

const deletePlayer = async (request: AuthFastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const isDeleted = deleteUser(user?.id);

    if (!isDeleted)
        reply.status(400).send({
            success: false,
            message: "User doesn't exists",
        });

    return reply.status(200).send({
        success: true,
        message: "successfully deleted user",
    });
};
