import AppError from "../utils/error";
import { UserSession } from "../types/user.types";

/**
 * Uses javascript's in built memory / ram for storing user data
 */
const userMap = new Map<string, UserSession>();

/**
* Adds a new player session to the server’s in-memory storage.
* @param id - The unique identifier of the session.
* @param initiatedAt - The timestamp when the session was initiated.
* @param expiresAt - The timestamp when the session expires.
* @returns The created UserSession object.
*/
export const addNewPlayer = (
    id: string,
    nickname: string,
    intiatedAt: number,
    expiresAt: number
): UserSession => {
    if (id.trim()) throw new AppError("Id not found", 404);

    const expireTimeInMs = expiresAt - Date.now();
    if (expireTimeInMs <= 0) {
        throw new Error("expiresAt must be a future timestamp");
    }

    const existingPlayer = userMap.get(id);
    if (existingPlayer) {
        clearTimeout(existingPlayer.expiryTimer);
    }

    //Stores the id for setTimeout, used to delete when neccessary
    const expiryTimer = setTimeout(() => {
        const existingPlayer = userMap.get(id);
        if (existingPlayer) userMap.delete(id);
    }, expireTimeInMs);

    const newUser: UserSession = {
        id: id,
        nickname: nickname,
        initiatedAt: intiatedAt,
        expiresAt: expiresAt,
        expiryTimer: expiryTimer,
    };

    userMap.set(id, newUser);
    return newUser;
};

/**
 * @param id - The unique identifier of the session.
 * deletes user details from memory / ram by javascript runtime
 */
export const deleteUser = (id: string) => {
    const existingPlayer = userMap.get(id);
    if (!existingPlayer) return false;

    clearTimeout(existingPlayer.expiryTimer);
    return userMap.delete(id);
};

/**
* Retrieves a user’s session by ID.
* Checks whether the session has expired before returning it.
* @param id - The unique identifier of the session.
* @returns The UserSession if found and valid; otherwise, undefined.
*/
export const getUserDetails = (id: string): UserSession | undefined => {
    const existingPlayer = userMap.get(id);
    if (!existingPlayer) return undefined;

    if (Date.now() > existingPlayer.expiresAt) {
        deleteUser(id);
        return undefined;
    }

    return existingPlayer;
};
