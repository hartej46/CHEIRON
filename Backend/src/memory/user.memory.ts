import AppError from "../utils/error";

interface UserSession {
    id: string;
    initiatedAt: number;
    expiresAt: number;
    expiryTimer: ReturnType<typeof setTimeout>;      //id for setTimeout for specific user
}

/**
 * Uses javascript's in built memory / ram for storing user data
 */
const userMap = new Map<string, UserSession>();

/**
 * 
 * @param id 
 * @param intiatedAt 
 * @param expiresAt 
 * @returns {UserSession} this retuens UserSession on successfully adding new User
 * Added player to Ram of server  
 */
const addNewPlayer = (id: string, intiatedAt: number, expiresAt: number): UserSession=> {
    if(id.trim()) throw new AppError("Id not found", 404);

    const expireTimeInMs = expiresAt - Date.now();
    if (expireTimeInMs <= 0) {
        throw new Error("expiresAt must be a future timestamp");
    }

    const existingPlayer = userMap.get(id);
    if(existingPlayer){
      clearTimeout(existingPlayer.expiryTimer);
    }

    //Stores the id for setTimeout, used to delete when neccessary
  const expiryTimer = setTimeout(() => {
    const existingPlayer = userMap.get(id);
    if (existingPlayer) userMap.delete(id);
  }, expireTimeInMs);

  const newUser: UserSession = {
    id: id,
    initiatedAt: intiatedAt,
    expiresAt: expiresAt,
    expiryTimer: expiryTimer
  }

  userMap.set(id, newUser);
  return newUser;
}

/**
 * 
 * @param id 
 * deletes user details from memory / ram by javascript runtime
 */
const deleteUser = (id: string) => {
    const existingPlayer = userMap.get(id);
    if (!existingPlayer) return false;

    clearTimeout(existingPlayer.expiryTimer);
    return userMap.delete(id);
}

/**
 * @param id 
 * @returns {UserSession | undefined} on successfully fetching or undefined
 * This function by default checks expiry for userData
 */
const getUserDetails = (id: string): UserSession | undefined=> {
    const existingPlayer = userMap.get(id);
    if (!existingPlayer) return undefined;

    if (Date.now() > existingPlayer.expiresAt) {
        deleteUser(id);
        return undefined;
    };

    return existingPlayer;
}
