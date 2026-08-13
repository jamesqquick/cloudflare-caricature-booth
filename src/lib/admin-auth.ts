/** Admin auth helpers for Cloudflare Access-protected routes. */

import type { MiddlewareHandler } from "hono";
import {
	createRemoteJWKSet,
	customFetch,
	decodeProtectedHeader,
	errors,
	jwtVerify,
} from "jose";

const ACCESS_JWT_HEADER = "CF-Access-Jwt-Assertion";
const REQUESTED_WITH_HEADER = "X-Requested-With";
const REQUESTED_WITH_VALUE = "XMLHttpRequest";
const JWKS_CACHE_MAX_SIZE = 4;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const jwksByTeamDomain = new Map<
	string,
	ReturnType<typeof createRemoteJWKSet>
>();

interface AccessConfig {
	teamDomain: string;
	productionHostname: string;
	productionAudience: string;
	previewAudience: string;
}

class AccessConfigurationError extends Error {
	readonly code = "ACCESS_CONFIGURATION_INVALID";

	constructor() {
		super("Cloudflare Access configuration is missing or invalid");
		this.name = "AccessConfigurationError";
	}
}

/** Constant-time string compare (lengths must match — short-circuit allowed). */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function readAccessConfig(env: Env): AccessConfig {
	const productionHostname = normalizeHostname(env.CF_ACCESS_PRODUCTION_HOSTNAME);
	const productionAudience = env.CF_ACCESS_PRODUCTION_AUDIENCE?.trim();
	const previewAudience = env.CF_ACCESS_PREVIEW_AUDIENCE?.trim();

	let teamDomainUrl: URL;
	try {
		teamDomainUrl = new URL(env.CF_ACCESS_TEAM_DOMAIN?.trim());
	} catch {
		throw new AccessConfigurationError();
	}

	if (
		teamDomainUrl.protocol !== "https:" ||
		teamDomainUrl.username ||
		teamDomainUrl.password ||
		teamDomainUrl.pathname !== "/" ||
		teamDomainUrl.search ||
		teamDomainUrl.hash ||
		!teamDomainUrl.hostname.endsWith(".cloudflareaccess.com") ||
		!productionHostname ||
		!productionAudience ||
		!previewAudience
	) {
		throw new AccessConfigurationError();
	}

	return {
		teamDomain: teamDomainUrl.origin,
		productionHostname,
		productionAudience,
		previewAudience,
	};
}

function getJwksInfrastructureErrorCode(error: unknown): string | undefined {
	if (
		error instanceof errors.JWKSTimeout ||
		error instanceof errors.JWKSInvalid ||
		error instanceof errors.JWKInvalid ||
		(error instanceof errors.JOSEError && error.code === "ERR_JOSE_GENERIC")
	) {
		return error.code;
	}

	return undefined;
}

function normalizeHostname(value: string | undefined): string | undefined {
	const hostname = value?.trim().toLowerCase();
	if (!hostname) return undefined;

	try {
		const parsed = new URL(`https://${hostname}`);
		return parsed.host === hostname ? parsed.hostname : undefined;
	} catch {
		return undefined;
	}
}

function isLoopbackHostname(hostname: string): boolean {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]"
	);
}

function usesSupportedAlgorithm(token: string): boolean {
	try {
		return decodeProtectedHeader(token).alg === "RS256";
	} catch {
		return false;
	}
}

function isWorkersPreviewHostname(
	hostname: string,
	productionHostname: string,
): boolean {
	const productionLabels = productionHostname.split(".");
	const hostnameLabels = hostname.split(".");
	if (
		productionLabels.length !== 4 ||
		hostnameLabels.length !== productionLabels.length ||
		productionLabels.slice(2).join(".") !== "workers.dev" ||
		hostnameLabels.slice(1).join(".") !== productionLabels.slice(1).join(".")
	) {
		return false;
	}

	const productionWorker = productionLabels[0];
	const previewLabel = hostnameLabels[0];
	return (
		previewLabel.length > productionWorker.length + 1 &&
		previewLabel.endsWith(`-${productionWorker}`)
	);
}

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
	const cached = jwksByTeamDomain.get(teamDomain);
	if (cached) return cached;

	if (jwksByTeamDomain.size >= JWKS_CACHE_MAX_SIZE) {
		const oldestTeamDomain = jwksByTeamDomain.keys().next().value;
		if (oldestTeamDomain) jwksByTeamDomain.delete(oldestTeamDomain);
	}

	const jwks = createRemoteJWKSet(
		new URL("/cdn-cgi/access/certs", teamDomain),
		{
			[customFetch]: async (url, options) => {
				try {
					return await fetch(url, options);
				} catch (error) {
					if (error instanceof Error && error.name === "TimeoutError") {
						throw error;
					}
					throw new errors.JOSEError("JWKS request failed", { cause: error });
				}
			},
		},
	);
	jwksByTeamDomain.set(teamDomain, jwks);
	return jwks;
}

/**
 * Hono middleware that validates Cloudflare Access JWTs for all admin routes.
 * Loopback requests bypass Access for local development only.
 */
export function adminAuthMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const requestUrl = new URL(c.req.url);
		const hostname = requestUrl.hostname.toLowerCase();
		if (isLoopbackHostname(hostname)) return next();

		const path = c.req.path;
		const configuredProductionHostname = normalizeHostname(
			c.env.CF_ACCESS_PRODUCTION_HOSTNAME,
		);
		const isAdminPage = path === "/admin" || path.startsWith("/admin/");
		const isAdminApi =
			path === "/api/admin" || path.startsWith("/api/admin/");
		const isApi = path === "/api" || path.startsWith("/api/");
		if (
			hostname === configuredProductionHostname &&
			!isAdminPage &&
			!isAdminApi
		) {
			return next();
		}

		let config: AccessConfig;
		try {
			config = readAccessConfig(c.env);
		} catch (error) {
			const configError =
				error instanceof AccessConfigurationError
					? error
					: new AccessConfigurationError();
			console.error({
				event: "admin_access_configuration_error",
				error: configError.name,
				code: configError.code,
				hostname,
			});
			return isApi
				? c.json({ error: "authentication unavailable" }, 500)
				: c.text("Authentication unavailable", 500);
		}

		const isProduction = hostname === config.productionHostname;
		const isPreview = isWorkersPreviewHostname(
			hostname,
			config.productionHostname,
		);
		if (!isPreview && !(isProduction && (isAdminPage || isAdminApi))) {
			if (isAdminPage || isAdminApi) {
				return isApi
					? c.json({ error: "unauthorized" }, 401)
					: c.text("Unauthorized", 401);
			}
			return next();
		}

		const audience = isProduction
			? config.productionAudience
			: config.previewAudience;
		const token = c.req.header(ACCESS_JWT_HEADER);

		if (audience && token && usesSupportedAlgorithm(token)) {
			try {
				await jwtVerify(token, getJwks(config.teamDomain), {
					algorithms: ["RS256"],
					issuer: config.teamDomain,
					audience,
				});
				if (isAdminApi && !SAFE_METHODS.has(c.req.method)) {
					const origin = c.req.header("Origin");
					const requestedWith = c.req.header(REQUESTED_WITH_HEADER);
					if (
						origin !== requestUrl.origin ||
						requestedWith !== REQUESTED_WITH_VALUE
					) {
						return c.json({ error: "forbidden" }, 403);
					}
				}
				return next();
			} catch (error) {
				const infrastructureErrorCode =
					getJwksInfrastructureErrorCode(error);
				if (infrastructureErrorCode) {
					console.error({
						event: "admin_access_jwks_error",
						error:
							error instanceof Error ? error.name : "UnknownInfrastructureError",
						code: infrastructureErrorCode,
						hostname,
					});
					return isApi
						? c.json({ error: "authentication unavailable" }, 503)
						: c.text("Authentication unavailable", 503);
				}
			}
		}

		if (isApi) {
			return c.json({ error: "unauthorized" }, 401);
		}
		return c.text("Unauthorized", 401);
	};
}
