import type { FastifyReply, FastifyRequest } from "fastify";

export interface IceServerEntry {
    urls: string | string[];
    username?: string;
    credential?: string;
}

const DEFAULT_STUN_SERVERS: IceServerEntry[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
];

const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

let cachedTurnServers: IceServerEntry[] | null = null;
let cacheExpiresAt = 0;

function hasTurnEntry(servers: IceServerEntry[]): boolean {
    return servers.some((entry) => {
        const urls = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
        return urls.some((u) => u.startsWith("turn:") || u.startsWith("turns:"));
    });
}

async function fetchCloudflareTurn(
    keyId: string,
    apiToken: string,
    req: FastifyRequest
): Promise<IceServerEntry[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ttl: 3600 }),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            req.log.warn(
                { status: response.status },
                "Cloudflare TURN credential request failed"
            );
            return [];
        }

        const data = (await response.json()) as { iceServers?: IceServerEntry[] };
        return Array.isArray(data.iceServers) ? data.iceServers : [];
    } catch (error) {
        req.log.warn({ err: error }, "Cloudflare TURN credential fetch error");
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchMeteredTurn(
    appName: string,
    apiKey: string,
    req: FastifyRequest
): Promise<IceServerEntry[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const cleanHost = appName.includes(".")
            ? appName
            : `${appName}.metered.live`;
        const response = await fetch(
            `https://${cleanHost}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`,
            { signal: controller.signal }
        );

        if (!response.ok) {
            req.log.warn(
                { status: response.status },
                "Metered TURN credential request failed"
            );
            return [];
        }

        const data = (await response.json()) as IceServerEntry[];
        return Array.isArray(data) ? data : [];
    } catch (error) {
        req.log.warn({ err: error }, "Metered TURN credential fetch error");
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

function getStaticTurnServers(config: FastifyRequest["server"]["config"]): IceServerEntry[] {
    const rawUrls = config.TURN_URLS?.trim();
    if (!rawUrls) return [];

    const urls = rawUrls
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);

    if (urls.length === 0) return [];

    return [
        {
            urls,
            ...(config.TURN_USERNAME ? { username: config.TURN_USERNAME } : {}),
            ...(config.TURN_CREDENTIAL ? { credential: config.TURN_CREDENTIAL } : {}),
        },
    ];
}

/**
 * Returns STUN + TURN ICE server configuration for WebRTC peers.
 * Supports free-tier Cloudflare Realtime TURN, Metered.ca TURN, or static TURN env vars.
 */
export async function getIceServers(req: FastifyRequest, reply: FastifyReply) {
    const config = req.server.config;
    const now = Date.now();

    if (cachedTurnServers && now < cacheExpiresAt) {
        return reply.send({
            success: true,
            iceServers: [...DEFAULT_STUN_SERVERS, ...cachedTurnServers],
            hasTurn: hasTurnEntry(cachedTurnServers),
        });
    }

    const dynamicTurnServers: IceServerEntry[] = [];

    if (config.CLOUDFLARE_TURN_KEY_ID && config.CLOUDFLARE_TURN_API_TOKEN) {
        const cfServers = await fetchCloudflareTurn(
            config.CLOUDFLARE_TURN_KEY_ID,
            config.CLOUDFLARE_TURN_API_TOKEN,
            req
        );
        dynamicTurnServers.push(...cfServers);
    }

    if (config.METERED_APP_NAME && config.METERED_API_KEY) {
        const meteredServers = await fetchMeteredTurn(
            config.METERED_APP_NAME,
            config.METERED_API_KEY,
            req
        );
        dynamicTurnServers.push(...meteredServers);
    }

    const staticServers = getStaticTurnServers(config);
    const turnServers = [...dynamicTurnServers, ...staticServers];

    if (turnServers.length > 0) {
        cachedTurnServers = turnServers;
        cacheExpiresAt = now + CACHE_TTL_MS;
    }

    const iceServers = [...DEFAULT_STUN_SERVERS, ...turnServers];

    return reply.send({
        success: true,
        iceServers,
        hasTurn: hasTurnEntry(iceServers),
    });
}
