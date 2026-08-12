import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { adminEventsApiRoutes } from "../src/routes/admin-events-api";

const eventId = "nyc-tech-week-2026";
const adminEventUrl = `https://example.com/api/admin/events/${eventId}`;

async function updateEvent(body: Record<string, unknown>): Promise<Response> {
	return adminEventsApiRoutes.request(
		adminEventUrl,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		env,
	);
}

describe("event booth title", () => {
	it("defaults existing and new events to AI Caricature Booth", async () => {
		const event = await env.DB.prepare(
			"SELECT booth_title FROM events WHERE id = ?",
		)
			.bind(eventId)
			.first<{ booth_title: string }>();

		expect(event?.booth_title).toBe("AI Caricature Booth");

		await env.DB.prepare(
			"INSERT INTO events (id, name, status) VALUES (?, ?, ?)",
		)
			.bind("new-event", "New Event", "draft")
			.run();
		const newEvent = await env.DB.prepare(
			"SELECT booth_title FROM events WHERE id = ?",
		)
			.bind("new-event")
			.first<{ booth_title: string }>();
		expect(newEvent?.booth_title).toBe("AI Caricature Booth");
	});

	it("stores a trimmed title and rejects whitespace-only values", async () => {
		const updateResponse = await updateEvent({ booth_title: "  Sketch Lab  " });
		expect(updateResponse.status).toBe(200);

		const event = await env.DB.prepare(
			"SELECT booth_title FROM events WHERE id = ?",
		)
			.bind(eventId)
			.first<{ booth_title: string }>();
		expect(event?.booth_title).toBe("Sketch Lab");

		const invalidResponse = await updateEvent({ booth_title: "   " });
		expect(invalidResponse.status).toBe(400);
		expect(await invalidResponse.json()).toEqual({
			error: "Booth title is required",
		});
	});

	it("copies the booth title when cloning an event", async () => {
		await updateEvent({ booth_title: "Portrait Studio" });

		const cloneResponse = await adminEventsApiRoutes.request(
			`${adminEventUrl}/clone`,
			{ method: "POST" },
			env,
		);
		expect(cloneResponse.status).toBe(200);
		const { newEventId } = await cloneResponse.json<{ newEventId: string }>();

		const clone = await env.DB.prepare(
			"SELECT booth_title FROM events WHERE id = ?",
		)
			.bind(newEventId)
			.first<{ booth_title: string }>();
		expect(clone?.booth_title).toBe("Portrait Studio");
	});

	it("renders the escaped event title on customer-facing pages", async () => {
		await updateEvent({ booth_title: "<Booth & Co>" });

		for (const pathname of [
			`/e/${eventId}`,
			`/e/${eventId}/kiosk`,
			`/e/${eventId}/privacy`,
		]) {
			const response = await SELF.fetch(`https://example.com${pathname}`);
			const html = await response.text();

			expect(response.status, pathname).toBe(200);
			expect(html).toContain("&lt;Booth &amp; Co&gt;");
			expect(html).not.toContain("AI Caricature Booth");
			expect(html).not.toContain("<Booth & Co>");
		}
	});

	it("defaults legacy cached events that do not include a booth title", async () => {
		const event = await env.DB.prepare("SELECT * FROM events WHERE id = ?")
			.bind(eventId)
			.first<Record<string, unknown>>();
		expect(event).not.toBeNull();
		delete event?.booth_title;
		await env.CONFIG.put(
			`event:${eventId}`,
			JSON.stringify({ event, scenes: [] }),
		);

		const response = await SELF.fetch(`https://example.com/e/${eventId}`);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("AI Caricature Booth");
	});
});
