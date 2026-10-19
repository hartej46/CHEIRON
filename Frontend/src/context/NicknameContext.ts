import { createContext, useContext } from "react";

export interface NicknameContextValue {
    nickname: string;
    setNickname: (nickname: string) => void;
}

export const NicknameContext = createContext<NicknameContextValue | null>(null);

export function useNickname() {
    const context = useContext(NicknameContext);

    if (!context) {
        throw new Error("useNickname must be used within NicknameContext");
    }

    return context;
}
