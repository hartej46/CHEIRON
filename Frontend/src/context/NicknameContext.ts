import { createContext, useContext } from "react";
import type { GuestProfile } from "../service/service";

export interface NicknameContextValue {
    nickname: string;
    setNickname: (nickname: string) => void;
    userData: GuestProfile | null;
    setUserData: (data: GuestProfile | null) => void;
    isLoggedIn: boolean;
    isCheckingSession: boolean;
    updateUsername: (newNickname: string) => Promise<void>;
    deleteUserId: () => Promise<void>;
    refreshSession: () => Promise<GuestProfile | null>;
}

export const NicknameContext = createContext<NicknameContextValue | null>(null);

export function useNickname() {
    const context = useContext(NicknameContext);

    if (!context) {
        throw new Error("useNickname must be used within NicknameContext");
    }

    return context;
}

