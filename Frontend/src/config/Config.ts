export const config = {
    // In local development, use relative URL ("") so requests go through the Vite proxy.
    // In production or custom deploys, use the configured VITE_BACKEND_URL.
    apiURL:
        import.meta.env.VITE_BACKEND_URL &&
        !import.meta.env.VITE_BACKEND_URL.includes("localhost:3000") &&
        !import.meta.env.VITE_BACKEND_URL.includes("127.0.0.1:3000")
            ? import.meta.env.VITE_BACKEND_URL
            : "",
};
