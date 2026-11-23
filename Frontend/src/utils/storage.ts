let memoryToken: string | null = null;

export function getStoredToken(): string | null {
    try {
        const token = window.sessionStorage?.getItem("jwtToken");
        if (token) return token;
    } catch {
        // Browser blocked sessionStorage access
    }

    try {
        const token = window.localStorage?.getItem("jwtToken");
        if (token) return token;
    } catch {
        // Browser blocked localStorage access
    }

    return memoryToken;
}

export function setStoredToken(token: string): void {
    memoryToken = token;
    try {
        window.sessionStorage?.setItem("jwtToken", token);
    } catch {
        // Browser blocked sessionStorage access
    }
    try {
        window.localStorage?.setItem("jwtToken", token);
    } catch {
        // Browser blocked localStorage access
    }
}

export function removeStoredToken(): void {
    memoryToken = null;
    try {
        window.sessionStorage?.removeItem("jwtToken");
    } catch {
        // Browser blocked sessionStorage access
    }
    try {
        window.localStorage?.removeItem("jwtToken");
    } catch {
        // Browser blocked localStorage access
    }
}
