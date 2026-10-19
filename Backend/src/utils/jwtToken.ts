import jwt from "jsonwebtoken";
import { UserSession } from "../types/user.types";
import {envConfig} from "../app.ts"

const generateToken = (userDetails: UserSession) => {
    const token = jwt.sign(
        userDetails,
        envConfig.JWT_TOKEN_SECERT,
        {
            expiresIn: userDetails.expiresAt
        }
    )
}