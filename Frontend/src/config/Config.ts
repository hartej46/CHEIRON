const rawBackendUrl = import.meta.env.VITE_BACKEND_URL;
const normalizedBackendUrl = rawBackendUrl?.trim().replace(/\/+$/, "");

if (import.meta.env.PROD && !normalizedBackendUrl) {
    console.error(
        "VITE_BACKEND_URL is not configured. Socket.IO and API requests will use the frontend origin.",
    );
}

export const config = {
    // In local development, use relative URL ("") so requests go through the Vite proxy.
    // In production or custom deploys, use the configured VITE_BACKEND_URL without trailing slash.
    apiURL:
        normalizedBackendUrl &&
        !normalizedBackendUrl.includes("localhost:3000") &&
        !normalizedBackendUrl.includes("127.0.0.1:3000")
            ? normalizedBackendUrl
            : "",
};
