import AppError from "../utils/error";

interface UserSession {
    id: string;
    initiatedAt: number;
    expiresAt: number;
    expiryTimer: ReturnType<typeof setTimeout>;
}

const userMap = new Map<string, UserSession>();

const addNewPlayer = (id: string, intiatedAt: number, expiresAt: number) => {
    if(id.trim()) throw new AppError("Id not found", 404);

    const expireTimeInMs = expiresAt - Date.now();
    if (expireTimeInMs <= 0) {
        throw new Error("expiresAt must be a future timestamp");
    }

    const existingPlayer = userMap.get(id);
    if(existingPlayer){
      clearTimeout(existingPlayer.expiryTimer);
    }

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

const deleteUser = (id: string) => {
    const existingPlayer = userMap.get(id);
    if (!existingPlayer) return false;

    clearTimeout(existingPlayer.expiryTimer);
    return userMap.delete(id);
}

const getUserDetails = (id: string) => {
    const existingPlayer = userMap.get(id);
    if (!existingPlayer) return undefined;

    if (Date.now() > existingPlayer.expiresAt) {
        deleteUser(id);
        return undefined;
    };

    return existingPlayer;
}
