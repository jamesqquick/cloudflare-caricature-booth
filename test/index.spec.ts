import { env } from "cloudflare:workers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Hono } from "hono";
import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import worker from "../src/index";
import { adminAuthMiddleware } from "../src/lib/admin-auth";

const PRODUCTION_HOSTNAME = "caricature-booth.examples.workers.dev";
const PREVIEW_HOSTNAME = `preview-${PRODUCTION_HOSTNAME}`;
const PRODUCTION_AUDIENCE = "production-audience";
const PREVIEW_AUDIENCE = "preview-audience";
const KEY_ID = "test-key";

type AccessEnv = Pick<
	Env,
	| "CF_ACCESS_TEAM_DOMAIN"
	| "CF_ACCESS_PRODUCTION_HOSTNAME"
	| "CF_ACCESS_PRODUCTION_AUDIENCE"
	| "CF_ACCESS_PREVIEW_AUDIENCE"
>;

const middlewareApp = new Hono<{ Bindings: Env }>();
middlewareApp.use("*", adminAuthMiddleware());
middlewareApp.all("*", (c) => c.json({ ok: true }));

let privateKey: CryptoKey;
let untrustedPrivateKey: CryptoKey;
let publicJwk: Awaited<ReturnType<typeof exportJWK>>;
let untrustedPublicJwk: Awaited<ReturnType<typeof exportJWK>>;
let teamDomainSequence = 0;

beforeAll(async () => {
	const keyPair = await generateKeyPair("RS256");
	privateKey = keyPair.privateKey;
	const untrustedKeyPair = await generateKeyPair("RS256");
	untrustedPrivateKey = untrustedKeyPair.privateKey;
	publicJwk = {
		...(await exportJWK(keyPair.publicKey)),
		alg: "RS256",
		kid: KEY_ID,
		use: "sig",
	};
	untrustedPublicJwk = {
		...(await exportJWK(untrustedKeyPair.publicKey)),
		alg: "RS256",
		kid: "unknown-key",
		use: "sig",
	};
});

afterEach(() => {
	vi.restoreAllMocks();
});

function nextTeamDomain(): string {
	teamDomainSequence += 1;
	return `https://test-${teamDomainSequence}.cloudflareaccess.com`;
}

function testEnv(
	teamDomain: string,
	overrides: Partial<AccessEnv> = {},
): Env {
	return {
		...env,
		ADMIN_PASSWORD: "",
		CF_ACCESS_TEAM_DOMAIN: teamDomain,
		CF_ACCESS_PRODUCTION_HOSTNAME: PRODUCTION_HOSTNAME,
		CF_ACCESS_PRODUCTION_AUDIENCE: PRODUCTION_AUDIENCE,
		CF_ACCESS_PREVIEW_AUDIENCE: PREVIEW_AUDIENCE,
		...overrides,
	};
}

function mockJwksResponse(
	keys: Awaited<ReturnType<typeof exportJWK>>[] = [publicJwk],
) {
	return vi.spyOn(globalThis, "fetch").mockResolvedValue(
		Response.json({ keys }),
	);
}

async function signAccessToken(
	teamDomain: string,
	audience: string,
	expiration: string | number = "5m",
	options: {
		issuer?: string;
		kid?: string;
		key?: CryptoKey;
	} = {},
): Promise<string> {
	return new SignJWT({ email: "admin@example.com" })
		.setProtectedHeader({ alg: "RS256", kid: options.kid ?? KEY_ID })
		.setIssuedAt()
		.setIssuer(options.issuer ?? teamDomain)
		.setAudience(audience)
		.setExpirationTime(expiration)
		.sign(options.key ?? privateKey);
}

function signUnsupportedAlgorithmToken(
	teamDomain: string,
	audience: string,
): Promise<string> {
	return new SignJWT({ email: "admin@example.com" })
		.setProtectedHeader({ alg: "HS256", kid: KEY_ID })
		.setIssuedAt()
		.setIssuer(teamDomain)
		.setAudience(audience)
		.setExpirationTime("5m")
		.sign(new TextEncoder().encode("a-secure-32-byte-test-secret-value"));
}

async function middlewareRequest(
	hostname: string,
	path: string,
	bindings: Env,
	token?: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = new Headers(init.headers);
	if (token) headers.set("CF-Access-Jwt-Assertion", token);
	return await middlewareApp.request(
		`https://${hostname}${path}`,
		{
			...init,
			headers,
		},
		bindings,
	);
}

async function workerRequest(
	path: string,
	bindings: Env,
	init?: RequestInit,
	hostname = PRODUCTION_HOSTNAME,
): Promise<Response> {
	return await worker.request(
		`https://${hostname}${path}`,
		init,
		bindings,
	);
}

describe("admin route wiring", () => {
	it.each(["/admin", "/admin/events"])(
		"protects browser route %s",
		async (path) => {
			const response = await workerRequest(path, testEnv(nextTeamDomain()));

			expect(response.status).toBe(401);
			expect(await response.text()).toBe("Unauthorized");
		},
	);

	it.each(["/%61dmin", "/%61dmin/events"])(
		"protects encoded browser route %s",
		async (path) => {
			const response = await workerRequest(path, testEnv(nextTeamDomain()));

			expect(response.status).toBe(401);
			expect(await response.text()).toBe("Unauthorized");
		},
	);

	it.each(["/api/admin", "/api/admin/sessions"])(
		"protects API route %s",
		async (path) => {
			const response = await workerRequest(path, testEnv(nextTeamDomain()));

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: "unauthorized" });
		},
	);

	it.each(["/api/%61dmin", "/api/%61dmin/sessions"])(
		"protects encoded API route %s",
		async (path) => {
			const response = await workerRequest(path, testEnv(nextTeamDomain()));

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: "unauthorized" });
		},
	);

	it("leaves the health route public", async () => {
		const response = await workerRequest("/api/health", testEnv(nextTeamDomain()));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok", step: "11.4" });
	});

	it("leaves production public routes available with incomplete Access config", async () => {
		const response = await workerRequest(
			"/api/health",
			testEnv("", {
				CF_ACCESS_PRODUCTION_AUDIENCE: "",
				CF_ACCESS_PREVIEW_AUDIENCE: "",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok", step: "11.4" });
	});

	it("protects non-admin Preview routes", async () => {
		const response = await workerRequest(
			"/api/health",
			testEnv(nextTeamDomain()),
			undefined,
			PREVIEW_HOSTNAME,
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	it("accepts a Preview JWT on a non-admin route", async () => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await signAccessToken(teamDomain, PREVIEW_AUDIENCE);
		const response = await workerRequest(
			"/api/health",
			testEnv(teamDomain),
			{ headers: { "CF-Access-Jwt-Assertion": token } },
			PREVIEW_HOSTNAME,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok", step: "11.4" });
	});
});

describe("adminAuthMiddleware", () => {
	it.each(["localhost", "127.0.0.1", "[::1]"])(
		"bypasses Access for loopback host %s",
		async (hostname) => {
			const response = await middlewareRequest(
				hostname,
				"/admin",
				testEnv("", {
					CF_ACCESS_PRODUCTION_HOSTNAME: "",
					CF_ACCESS_PRODUCTION_AUDIENCE: "",
					CF_ACCESS_PREVIEW_AUDIENCE: "",
				}),
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ ok: true });
		},
	);

	it.each(["localhost.example.com", "127.0.0.2", "[::2]"])(
		"does not bypass Access for non-loopback host %s",
		async (hostname) => {
			const response = await middlewareRequest(
				hostname,
				"/admin",
				testEnv(nextTeamDomain()),
			);

			expect(response.status).toBe(401);
			expect(await response.text()).toBe("Unauthorized");
		},
	);

	it("accepts a valid production JWT with the production audience", async () => {
		const teamDomain = nextTeamDomain();
		const fetchSpy = mockJwksResponse();
		const token = await signAccessToken(teamDomain, PRODUCTION_AUDIENCE);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/admin",
			testEnv(teamDomain),
			token,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(fetchSpy).toHaveBeenCalledOnce();
		expect(fetchSpy.mock.calls[0][0].toString()).toBe(
			`${teamDomain}/cdn-cgi/access/certs`,
		);
	});

	it("accepts a valid preview JWT with the preview audience", async () => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await signAccessToken(teamDomain, PREVIEW_AUDIENCE);

		const response = await middlewareRequest(
			PREVIEW_HOSTNAME,
			"/admin",
			testEnv(teamDomain),
			token,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("rejects an authenticated admin mutation without same-origin intent headers", async () => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await signAccessToken(teamDomain, PRODUCTION_AUDIENCE);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/events/example/clone",
			testEnv(teamDomain),
			token,
			{ method: "POST" },
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "forbidden" });
	});

	it("applies mutation intent checks to encoded admin API paths", async () => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await signAccessToken(teamDomain, PRODUCTION_AUDIENCE);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/%61dmin/events/example/clone",
			testEnv(teamDomain),
			token,
			{ method: "POST" },
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "forbidden" });
	});

	it("accepts an authenticated same-origin admin mutation", async () => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await signAccessToken(teamDomain, PRODUCTION_AUDIENCE);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/events/example/clone",
			testEnv(teamDomain),
			token,
			{
				method: "POST",
				headers: {
					Origin: `https://${PRODUCTION_HOSTNAME}`,
					"X-Requested-With": "XMLHttpRequest",
				},
			},
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("rejects an authenticated cross-origin admin mutation", async () => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await signAccessToken(teamDomain, PRODUCTION_AUDIENCE);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/events/example/clone",
			testEnv(teamDomain),
			token,
			{
				method: "POST",
				headers: {
					Origin: "https://attacker.example",
					"X-Requested-With": "XMLHttpRequest",
				},
			},
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "forbidden" });
	});

	it.each([
		[PRODUCTION_HOSTNAME, PREVIEW_AUDIENCE],
		[PREVIEW_HOSTNAME, PRODUCTION_AUDIENCE],
	])(
		"rejects an audience mismatch for %s",
		async (hostname, audience) => {
			const teamDomain = nextTeamDomain();
			mockJwksResponse();
			const token = await signAccessToken(teamDomain, audience);

			const response = await middlewareRequest(
				hostname,
				"/api/admin/sessions",
				testEnv(teamDomain),
				token,
			);

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: "unauthorized" });
		},
	);

	it.each([
		["expired", async (teamDomain: string) =>
			signAccessToken(
				teamDomain,
				PRODUCTION_AUDIENCE,
				Math.floor(Date.now() / 1000) - 60,
			)],
		["malformed", async () => "not-a-jwt"],
	] as const)("rejects %s tokens", async (_case, createToken) => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await createToken(teamDomain);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/sessions",
			testEnv(teamDomain),
			token,
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	it.each([
		["a wrong signature", (teamDomain: string) =>
			signAccessToken(teamDomain, PRODUCTION_AUDIENCE, "5m", {
				key: untrustedPrivateKey,
			})],
		["a wrong issuer", (teamDomain: string) =>
			signAccessToken(teamDomain, PRODUCTION_AUDIENCE, "5m", {
				issuer: "https://other.cloudflareaccess.com",
			})],
		["an unsupported algorithm", (teamDomain: string) =>
			signUnsupportedAlgorithmToken(teamDomain, PRODUCTION_AUDIENCE)],
	] as const)("rejects tokens with %s", async (_case, createToken) => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await createToken(teamDomain);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/sessions",
			testEnv(teamDomain),
			token,
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	it("rejects a token whose key ID selects the wrong key", async () => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse([publicJwk, untrustedPublicJwk]);
		const token = await signAccessToken(
			teamDomain,
			PRODUCTION_AUDIENCE,
			"5m",
			{ kid: "unknown-key" },
		);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/sessions",
			testEnv(teamDomain),
			token,
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	it.each([
		"unknown.examples.workers.dev",
		"preview-caricature-booths.examples.workers.dev",
		"preview-caricature-booth.example.workers.dev",
		"preview-caricature-booth.examples.workers.dev.example.com",
	])("rejects unknown or near-match hostname %s", async (hostname) => {
		const teamDomain = nextTeamDomain();
		mockJwksResponse();
		const token = await signAccessToken(teamDomain, PREVIEW_AUDIENCE);

		const response = await middlewareRequest(
			hostname,
			"/api/admin/sessions",
			testEnv(teamDomain),
			token,
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	it("returns a generic JSON 401 for API requests", async () => {
		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/sessions",
			testEnv(nextTeamDomain()),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	it("returns a plain 401 for browser requests", async () => {
		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/admin",
			testEnv(nextTeamDomain()),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("content-type")).toContain("text/plain");
		expect(await response.text()).toBe("Unauthorized");
	});

	it.each([
		["missing", { CF_ACCESS_TEAM_DOMAIN: "" }],
		["invalid", { CF_ACCESS_TEAM_DOMAIN: "https://access.invalid/private" }],
	] as const)("returns a sanitized 500 for %s config", async (_case, overrides) => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/sessions",
			testEnv(nextTeamDomain(), overrides),
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "authentication unavailable",
		});
	});

	it("returns a sanitized 503 when the JWKS request fails", async () => {
		const teamDomain = nextTeamDomain();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(globalThis, "fetch").mockRejectedValue(
			new Error("upstream unavailable"),
		);
		const token = await signAccessToken(teamDomain, PRODUCTION_AUDIENCE);

		const response = await middlewareRequest(
			PRODUCTION_HOSTNAME,
			"/api/admin/sessions",
			testEnv(teamDomain),
			token,
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: "authentication unavailable",
		});
	});
});
