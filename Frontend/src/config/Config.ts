const rawBackendUrl = import.meta.env.VITE_BACKEND_URL;

export const config = {
    // In local development, use relative URL ("") so requests go through the Vite proxy.
    // In production or custom deploys, use the configured VITE_BACKEND_URL without trailing slash.
    apiURL:
        rawBackendUrl &&
        !rawBackendUrl.includes("localhost:3000") &&
        !rawBackendUrl.includes("127.0.0.1:3000")
            ? rawBackendUrl.replace(/\/+$/, "")
            : "",
};
