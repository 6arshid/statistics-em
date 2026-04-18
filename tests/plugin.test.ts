import type { PluginContext, QueryOptions } from "emdash";
import { describe, expect, it, vi } from "vitest";

import { statisticsEm } from "../src/index.js";
import statisticsSandbox from "../src/sandbox-entry.js";

interface SessionRecord {
	id: string;
	visitorId: string;
	date: string;
	startTime: number;
	lastSeen: number;
	pageViews: number;
	isNew: boolean;
	source: string;
	referrer: string;
	utmSource: string;
	utmMedium: string;
	utmCampaign: string;
	country: string;
	region: string;
	city: string;
	language: string;
	timezone: string;
	ipHash: string;
	deviceType?: string;
	browser?: string;
	browserVersion?: string;
	os?: string;
	osVersion?: string;
	deviceBrand?: string;
	deviceModel?: string;
	screenWidth?: number;
	screenHeight?: number;
	entryPage?: string;
	exitPage?: string;
	lastContentKind?: string;
	maxScrollDepth?: number;
	visitedPages?: string[];
	recordingEventCount?: number;
	recordingUpdatedAt?: number;
	experiments?: Record<string, string>;
}

interface HttpStub {
	fetch: ReturnType<typeof vi.fn>;
}

class MemoryKv {
	private readonly data = new Map<string, unknown>();

	async get<T>(key: string): Promise<T | null> {
		return (this.data.get(key) as T | undefined) ?? null;
	}

	async set(key: string, value: unknown): Promise<void> {
		this.data.set(key, value);
	}

	async delete(key: string): Promise<boolean> {
		return this.data.delete(key);
	}

	async list(prefix = ""): Promise<Array<{ key: string; value: unknown }>> {
		return [...this.data.entries()]
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, value]) => ({ key, value }));
	}
}

class MemoryCollection<T extends Record<string, unknown>> {
	private readonly data = new Map<string, T>();

	async get(id: string): Promise<T | null> {
		return this.data.get(id) ?? null;
	}

	async put(id: string, value: T): Promise<void> {
		this.data.set(id, value);
	}

	async delete(id: string): Promise<boolean> {
		return this.data.delete(id);
	}

	async exists(id: string): Promise<boolean> {
		return this.data.has(id);
	}

	async getMany(ids: string[]): Promise<Map<string, T>> {
		const result = new Map<string, T>();
		for (const id of ids) {
			const value = this.data.get(id);
			if (value) result.set(id, value);
		}
		return result;
	}

	async putMany(items: Array<{ id: string; data: T }>): Promise<void> {
		for (const item of items) {
			this.data.set(item.id, item.data);
		}
	}

	async deleteMany(ids: string[]): Promise<number> {
		let deleted = 0;
		for (const id of ids) {
			if (this.data.delete(id)) deleted += 1;
		}
		return deleted;
	}

	async query(options?: QueryOptions): Promise<{
		items: Array<{ id: string; data: T }>;
		cursor?: string;
		hasMore: boolean;
	}> {
		let items = Array.from(this.data.entries(), ([id, data]) => ({ id, data }));

		const gte = options?.where?.date;
		if (gte && typeof gte === "object" && "gte" in gte) {
			items = items.filter((item) => {
				const dateValue = item.data.date;
				return typeof dateValue === "string" && dateValue >= String(gte.gte);
			});
		}

		const dateOrder = options?.orderBy?.date;
		if (dateOrder) {
			items = items.toSorted((a, b) =>
				dateOrder === "desc"
					? String(b.data.date ?? "").localeCompare(String(a.data.date ?? ""))
					: String(a.data.date ?? "").localeCompare(String(b.data.date ?? "")),
			);
		}

		const limit = options?.limit ?? items.length;
		return {
			items: items.slice(0, limit),
			hasMore: items.length > limit,
		};
	}

	async count(): Promise<number> {
		return this.data.size;
	}
}

function createContext(): PluginContext {
	const http: HttpStub = {
		fetch: vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
	};

	return {
		plugin: {
			id: "statistics-em",
			version: "1.0.0",
		},
		storage: {
			sessions: new MemoryCollection<SessionRecord>(),
		},
		kv: new MemoryKv(),
		log: {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
		site: {
			name: "Test Site",
			url: "https://example.com",
			locale: "en",
		},
		http,
		url(path: string) {
			return new URL(path, "https://example.com").toString();
		},
	} as PluginContext;
}

function createRouteContext(
	input: unknown,
	userAgent: string,
	options?: {
		cookie?: string;
		ip?: string;
		referer?: string | null;
		geo?: { country?: string | null; region?: string | null; city?: string | null } | null;
		requestUrl?: string;
	},
) {
	return {
		input,
		request: new Request(
			options?.requestUrl ?? "https://example.com/_emdash/api/plugins/statistics-em",
			{
				headers: options?.cookie ? { cookie: options.cookie } : undefined,
			},
		),
		requestMeta: {
			ip: options?.ip ?? "203.0.113.10",
			userAgent,
			referer: options?.referer ?? null,
			geo: options?.geo
				? {
						country: options.geo.country ?? null,
						region: options.geo.region ?? null,
						city: options.geo.city ?? null,
					}
				: null,
		},
	};
}

function getTableRowsAfterContext(
	blocks: unknown[],
	contextText: string,
): Array<Record<string, unknown>> {
	return getTableAfterContext(blocks, contextText)?.rows ?? [];
}

function getTableAfterContext(
	blocks: unknown[],
	contextText: string,
):
	| {
			columns: Array<{ key: string; label: string; format?: string }>;
			rows: Array<Record<string, unknown>>;
	  }
	| undefined {
	const index = (blocks as Array<Record<string, unknown>>).findIndex(
		(block) => block.type === "context" && block.text === contextText,
	);
	expect(index).toBeGreaterThan(-1);

	const table = (blocks as Array<Record<string, unknown>>)
		.slice(index + 1)
		.find((block) => block.type === "table") as
		| {
				columns: Array<{ key: string; label: string; format?: string }>;
				rows: Array<Record<string, unknown>>;
		  }
		| undefined;

	expect(table).toBeDefined();
	return table;
}

describe("statisticsEm descriptor", () => {
	it("declares the analytics page and widget", () => {
		const descriptor = statisticsEm();
		expect(descriptor.id).toBe("statistics-em");
		expect(descriptor.adminPages?.[0]?.path).toBe("/statistics");
		expect(descriptor.adminWidgets?.[0]?.id).toBe("visit-stats");
		expect(descriptor.capabilities).toContain("network:fetch");
		expect(descriptor.features).toEqual(
			expect.arrayContaining([
				"analytics:heatmap-tracking",
				"analytics:scroll-tracking",
				"analytics:session-recording",
				"analytics:funnel-analytics",
				"analytics:ab-testing",
				"analytics:cohort-analysis",
			]),
		);
	});
});

describe("statistics-em analytics tracking", () => {
	it("injects a same-origin tracking script", async () => {
		const fragmentsHook = statisticsSandbox.hooks?.["page:fragments"];
		if (!fragmentsHook || typeof fragmentsHook !== "object" || !("handler" in fragmentsHook)) {
			throw new Error("page:fragments hook is not configured");
		}

		const contributions = await fragmentsHook.handler({}, {
			url: (path: string) => `http://localhost:4321${path}`,
		} as PluginContext);

		expect(JSON.stringify(contributions)).toContain("/_emdash/api/plugins/statistics-em/track");
		expect(JSON.stringify(contributions)).not.toContain(
			"http://localhost:4321/_emdash/api/plugins/statistics-em/track",
		);
	});

	it("tracks device models and splits post/page analytics", async () => {
		const ctx = createContext();
		const trackHandler = statisticsSandbox.routes.track.handler;
		const adminHandler = statisticsSandbox.routes.admin.handler;

		const samsungUa =
			"Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
		const windowsUa =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-1",
					sid: "session-1",
					isNew: true,
					isNewSess: true,
					url: "/posts/launch",
					dt: "mobile",
					sw: 390,
					sh: 844,
					pgType: "article",
					pgCat: "Launches",
					pgTags: ["Release"],
					pgAuth: "Farshid",
				},
				samsungUa,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "end",
					vid: "visitor-1",
					sid: "session-1",
					url: "/posts/launch",
				},
				samsungUa,
			),
			ctx,
		);

		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-2",
					sid: "session-2",
					isNew: true,
					isNewSess: true,
					url: "/about",
					dt: "desktop",
					sw: 1440,
					sh: 900,
					pgType: "website",
				},
				windowsUa,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "end",
					vid: "visitor-2",
					sid: "session-2",
					url: "/about",
				},
				windowsUa,
			),
			ctx,
		);

		const firstSession = (await ctx.storage.sessions.get("session-1")) as SessionRecord | null;
		expect(firstSession?.deviceBrand).toBe("Samsung");
		expect(firstSession?.deviceModel).toContain("SM-S911B");

		const contentPage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:content",
				},
				windowsUa,
			),
			ctx,
		)) as { blocks: unknown[] };

		const postRows = getTableRowsAfterContext(contentPage.blocks, "Most viewed posts - 30 days");
		const pageRows = getTableRowsAfterContext(contentPage.blocks, "Most viewed pages - 30 days");
		expect(postRows[0]?.url).toBe("/posts/launch");
		expect(pageRows[0]?.url).toBe("/about");

		const devicePage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:devices",
				},
				windowsUa,
			),
			ctx,
		)) as { blocks: unknown[] };

		const modelRows = getTableRowsAfterContext(devicePage.blocks, "Device models - 30 days");
		expect(JSON.stringify(modelRows)).toContain("SM-S911B");
	});

	it("returns link-formatted page columns across analytics tables", async () => {
		const ctx = createContext();
		const trackHandler = statisticsSandbox.routes.track.handler;
		const adminHandler = statisticsSandbox.routes.admin.handler;
		const ua =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-link-post",
					sid: "session-link-post",
					isNew: true,
					isNewSess: true,
					url: "/posts/launch",
					dt: "desktop",
					pgType: "article",
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-link-1",
					sid: "session-link-1",
					isNew: true,
					isNewSess: true,
					url: "/pricing",
					dt: "desktop",
					pgType: "website",
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "scroll",
					vid: "visitor-link-1",
					sid: "session-link-1",
					url: "/pricing",
					depth: 82,
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "record",
					vid: "visitor-link-1",
					sid: "session-link-1",
					url: "/pricing",
					events: [{ type: "navigate", at: 0, page: "/pricing" }],
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-link-1",
					sid: "session-link-1",
					url: "/signup",
					dt: "desktop",
					pgType: "website",
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "end",
					vid: "visitor-link-1",
					sid: "session-link-1",
					url: "/signup",
				},
				ua,
			),
			ctx,
		);

		const contentPage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:content",
				},
				ua,
			),
			ctx,
		)) as { blocks: unknown[] };
		const livePage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:live",
				},
				ua,
			),
			ctx,
		)) as { blocks: unknown[] };
		const advancedPage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:advanced",
				},
				ua,
			),
			ctx,
		)) as { blocks: unknown[] };

		expect(
			getTableAfterContext(contentPage.blocks, "Most viewed posts - 30 days")?.columns[0]?.format,
		).toBe("link");
		expect(
			getTableAfterContext(contentPage.blocks, "Most viewed pages - 30 days")?.columns[0]?.format,
		).toBe("link");
		expect(getTableAfterContext(livePage.blocks, "Current active pages")?.columns[0]?.format).toBe(
			"link",
		);
		expect(getTableAfterContext(livePage.blocks, "Recent visitors feed")?.columns[1]?.format).toBe(
			"link",
		);
		expect(
			getTableAfterContext(advancedPage.blocks, "Scroll depth by page")?.columns[0]?.format,
		).toBe("link");
		expect(getTableAfterContext(advancedPage.blocks, "Funnel conversion")?.columns[0]?.format).toBe(
			"link",
		);
	});

	it("renders live visitor pages, referrers, and feed", async () => {
		const ctx = createContext();
		const trackHandler = statisticsSandbox.routes.track.handler;
		const adminHandler = statisticsSandbox.routes.admin.handler;

		const chromeUa =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-live-1",
					sid: "session-live-1",
					isNew: true,
					isNewSess: true,
					url: "/docs/seo",
					dt: "desktop",
					pgType: "website",
				},
				chromeUa,
				{
					referer: "https://www.google.com/search?q=emdash+seo",
					geo: { country: "DE", region: "Berlin", city: "Berlin" },
				},
			),
			ctx,
		);

		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-live-2",
					sid: "session-live-2",
					isNew: true,
					isNewSess: true,
					url: "/pricing",
					dt: "desktop",
					pgType: "website",
				},
				chromeUa,
				{
					referer: "https://news.ycombinator.com/item?id=1",
					geo: { country: "US", region: "California", city: "San Francisco" },
				},
			),
			ctx,
		);

		const livePage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:live",
				},
				chromeUa,
			),
			ctx,
		)) as {
			blocks: unknown[];
			refresh?: { everyMs: number; interaction: { type: string; action_id?: string } };
		};

		const activePageRows = getTableRowsAfterContext(livePage.blocks, "Current active pages");
		expect(JSON.stringify(activePageRows)).toContain("/docs/seo");

		const referrerRows = getTableRowsAfterContext(livePage.blocks, "Current referrers");
		expect(JSON.stringify(referrerRows)).toContain("google.com");
		expect(JSON.stringify(livePage.blocks)).toContain("Recent visitors feed");
		expect(JSON.stringify(livePage.blocks)).toContain("Live traffic map");
		expect(livePage.refresh).toEqual({
			everyMs: 15_000,
			interaction: { type: "block_action", action_id: "tab:live" },
		});
	});

	it("resolves the site origin dynamically for same-site referrals and absolute page URLs", async () => {
		const ctx = createContext();
		const trackHandler = statisticsSandbox.routes.track.handler;
		const adminHandler = statisticsSandbox.routes.admin.handler;
		const requestUrl = "https://tenant-one.example/_emdash/api/plugins/statistics-em";

		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-tenant-1",
					sid: "session-tenant-1",
					isNew: true,
					isNewSess: true,
					url: "https://tenant-one.example/posts/dynamic-origin",
					dt: "desktop",
					pgType: "article",
				},
				"Mozilla/5.0",
				{
					referer: "https://tenant-one.example/start-here",
					requestUrl,
				},
			),
			ctx,
		);

		const session = (await ctx.storage.sessions.get("session-tenant-1")) as SessionRecord | null;
		expect(session?.entryPage).toBe("/posts/dynamic-origin");
		expect(session?.source).toBe("direct");

		const livePage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:live",
				},
				"Mozilla/5.0",
				{ requestUrl },
			),
			ctx,
		)) as { blocks: unknown[] };

		const referrerRows = getTableRowsAfterContext(livePage.blocks, "Current referrers");
		expect(JSON.stringify(referrerRows)).toContain("Direct");
		expect(JSON.stringify(referrerRows)).not.toContain("tenant-one.example");
	});

	it("adds auto-refresh metadata to overview and widget responses", async () => {
		const ctx = createContext();
		const adminHandler = statisticsSandbox.routes.admin.handler;

		const overviewPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "/statistics",
				},
				"Mozilla/5.0",
			),
			ctx,
		)) as {
			refresh?: { everyMs: number; interaction: { type: string; page?: string } };
		};

		expect(overviewPage.refresh).toEqual({
			everyMs: 15_000,
			interaction: { type: "page_load", page: "/statistics" },
		});

		const widgetPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "widget:visit-stats",
				},
				"Mozilla/5.0",
			),
			ctx,
		)) as {
			refresh?: { everyMs: number; interaction: { type: string; page?: string } };
		};

		expect(widgetPage.refresh).toEqual({
			everyMs: 15_000,
			interaction: { type: "page_load", page: "widget:visit-stats" },
		});
	});

	it("returns Block Kit-compatible fields for the settings page", async () => {
		const ctx = createContext();
		const adminHandler = statisticsSandbox.routes.admin.handler;

		const settingsPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "/statistics/settings",
				},
				"Mozilla/5.0",
			),
			ctx,
		)) as { blocks: Array<Record<string, unknown>> };

		const forms = settingsPage.blocks.filter((block) => block.type === "form");
		expect(forms.length).toBeGreaterThan(0);

		const fields = forms.flatMap((block) => {
			const formFields = block.fields;
			return Array.isArray(formFields) ? formFields : [];
		}) as Array<Record<string, unknown>>;

		expect(fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "toggle",
					action_id: "darkMode",
					initial_value: false,
				}),
				expect.objectContaining({
					type: "text_input",
					action_id: "multiSiteLabel",
					initial_value: "",
				}),
				expect.objectContaining({
					type: "select",
					action_id: "defaultReportPeriod",
					initial_value: "daily",
				}),
			]),
		);
		expect(fields.some((field) => field.type === "checkbox" && !Array.isArray(field.options))).toBe(
			false,
		);
	});

	it("returns a dark theme override for plugin pages and widgets after enabling dashboard dark mode", async () => {
		const ctx = createContext();
		const adminHandler = statisticsSandbox.routes.admin.handler;

		await adminHandler(
			createRouteContext(
				{
					type: "form_submit",
					action_id: "save_dashboard_settings",
					values: {
						darkMode: true,
						multiSiteLabel: "",
						defaultReportPeriod: "daily",
					},
				},
				"Mozilla/5.0",
			),
			ctx,
		);

		const settingsPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "/statistics/settings",
				},
				"Mozilla/5.0",
			),
			ctx,
		)) as {
			appearance?: { themeMode?: "light" | "dark" };
		};

		const widgetPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "widget:traffic-chart",
				},
				"Mozilla/5.0",
			),
			ctx,
		)) as {
			appearance?: { themeMode?: "light" | "dark" };
		};

		expect(settingsPage.appearance).toEqual({ themeMode: "dark" });
		expect(widgetPage.appearance).toEqual({ themeMode: "dark" });
	});

	it("renders plugin admin strings in Arabic when the admin locale is Arabic", async () => {
		const ctx = createContext();
		const adminHandler = statisticsSandbox.routes.admin.handler;
		const cookie = "emdash-locale=ar";

		const overviewPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "/statistics",
				},
				"Mozilla/5.0",
				{ cookie },
			),
			ctx,
		)) as { blocks: unknown[] };

		const settingsPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "/statistics/settings",
				},
				"Mozilla/5.0",
				{ cookie },
			),
			ctx,
		)) as { blocks: unknown[] };

		const widgetPage = (await adminHandler(
			createRouteContext(
				{
					type: "page_load",
					page: "widget:visit-stats",
				},
				"Mozilla/5.0",
				{ cookie },
			),
			ctx,
		)) as { blocks: unknown[] };

		const saveResult = (await adminHandler(
			createRouteContext(
				{
					type: "form_submit",
					action_id: "save_dashboard_settings",
					values: {
						darkMode: false,
						multiSiteLabel: "",
						defaultReportPeriod: "daily",
					},
				},
				"Mozilla/5.0",
				{ cookie },
			),
			ctx,
		)) as { toast?: { message?: string } };

		expect(JSON.stringify(overviewPage.blocks)).toContain("لوحة تحكم التحليلات");
		expect(JSON.stringify(overviewPage.blocks)).toContain("تحديث");
		expect(JSON.stringify(overviewPage.blocks)).toContain("نظرة عامة");
		expect(JSON.stringify(settingsPage.blocks)).toContain("إعدادات لوحة التحكم وتعدد المواقع");
		expect(JSON.stringify(settingsPage.blocks)).toContain("حفظ إعدادات لوحة التحكم");
		expect(JSON.stringify(widgetPage.blocks)).toContain("الزوار الآن");
		expect(saveResult.toast?.message).toBe("تم حفظ إعدادات لوحة التحكم");
		expect(JSON.stringify(overviewPage.blocks)).not.toContain("Analytics Dashboard");
	});

	it("captures advanced analytics data for heatmaps, scroll depth, recordings, funnels, experiments, and cohorts", async () => {
		const ctx = createContext();
		const trackHandler = statisticsSandbox.routes.track.handler;
		const adminHandler = statisticsSandbox.routes.admin.handler;
		const ua =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

		await adminHandler(
			createRouteContext(
				{
					type: "form_submit",
					action_id: "save_advanced_settings",
					values: {
						heatmapTrackingEnabled: true,
						scrollTrackingEnabled: true,
						sessionRecordingEnabled: true,
						funnelAnalyticsEnabled: true,
						funnelSteps: "/pricing,/signup",
						abTestingEnabled: true,
						abExperiments: "pricing_test@/pricing->/signup:control,variant",
						cohortAnalysisEnabled: true,
					},
				},
				ua,
			),
			ctx,
		);

		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-advanced-1",
					sid: "session-advanced-1",
					isNew: true,
					isNewSess: true,
					url: "/pricing",
					dt: "desktop",
					pgType: "website",
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "scroll",
					vid: "visitor-advanced-1",
					sid: "session-advanced-1",
					url: "/pricing",
					depth: 82,
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "heat",
					vid: "visitor-advanced-1",
					sid: "session-advanced-1",
					url: "/pricing",
					x: 0.74,
					y: 0.28,
					target: "button#cta",
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "record",
					vid: "visitor-advanced-1",
					sid: "session-advanced-1",
					url: "/pricing",
					events: [
						{ type: "navigate", at: 0, page: "/pricing" },
						{ type: "scroll", at: 400, page: "/pricing", depth: 82 },
						{ type: "click", at: 900, page: "/pricing", x: 0.74, y: 0.28, target: "button#cta" },
					],
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "view",
					vid: "visitor-advanced-1",
					sid: "session-advanced-1",
					url: "/signup",
					dt: "desktop",
					pgType: "website",
				},
				ua,
			),
			ctx,
		);
		await trackHandler(
			createRouteContext(
				{
					a: "end",
					vid: "visitor-advanced-1",
					sid: "session-advanced-1",
					url: "/signup",
				},
				ua,
			),
			ctx,
		);

		const session = (await ctx.storage.sessions.get("session-advanced-1")) as SessionRecord | null;
		expect(session?.maxScrollDepth).toBe(82);
		expect(session?.visitedPages).toEqual(["/pricing", "/signup"]);
		expect(session?.recordingEventCount).toBe(3);
		expect(session?.experiments?.pricing_test).toBeTruthy();

		const advancedPage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:advanced",
				},
				ua,
			),
			ctx,
		)) as { blocks: unknown[] };

		expect(JSON.stringify(advancedPage.blocks)).toContain("Heatmap activity by page");
		expect(JSON.stringify(advancedPage.blocks)).toContain("Scroll depth by page");
		expect(JSON.stringify(advancedPage.blocks)).toContain("Recent session recordings");
		expect(JSON.stringify(advancedPage.blocks)).toContain("Funnel conversion");
		expect(JSON.stringify(advancedPage.blocks)).toContain("A/B experiments");
		expect(JSON.stringify(advancedPage.blocks)).toContain("Weekly cohort retention");
		expect(JSON.stringify(advancedPage.blocks)).toContain("pricing_test");
		expect(JSON.stringify(advancedPage.blocks)).toContain("/pricing");
	});

	it("loads Search Console keywords and indexed sitemap counts in the SEO tab", async () => {
		const ctx = createContext();
		const adminHandler = statisticsSandbox.routes.admin.handler;
		const http = ctx.http as HttpStub;

		http.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
			if (url.includes("/searchAnalytics/query")) {
				const rawBody = typeof init?.body === "string" ? init.body : "{}";
				const body = JSON.parse(rawBody) as { dimensions?: string[] };
				if ((body.dimensions ?? []).includes("query")) {
					return new Response(
						JSON.stringify({
							rows: [
								{
									keys: ["emdash analytics"],
									clicks: 84,
									impressions: 1400,
									ctr: 0.06,
									position: 4.2,
								},
								{
									keys: ["realtime seo dashboard"],
									clicks: 21,
									impressions: 410,
									ctr: 0.051,
									position: 7.8,
								},
							],
						}),
						{ status: 200 },
					);
				}

				return new Response(
					JSON.stringify({
						rows: [{ clicks: 120, impressions: 2400, ctr: 0.05, position: 5.4 }],
					}),
					{ status: 200 },
				);
			}

			if (url.endsWith("/sitemaps")) {
				return new Response(
					JSON.stringify({
						sitemap: [
							{
								path: "https://example.com/sitemap.xml",
								lastSubmitted: "2026-04-18T08:00:00.000Z",
								isPending: false,
								errors: "0",
								warnings: "0",
								contents: [{ type: "web", submitted: 120, indexed: 110 }],
							},
						],
					}),
					{ status: 200 },
				);
			}

			throw new Error(`Unexpected URL: ${url}`);
		});

		await adminHandler(
			createRouteContext(
				{
					type: "form_submit",
					action_id: "save_seo_settings",
					values: {
						searchConsoleEnabled: true,
						searchConsoleProperty: "https://example.com/",
						searchConsoleAccessToken: "ya29.test-token",
					},
				},
				"Mozilla/5.0",
			),
			ctx,
		);

		const seoPage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:seo",
				},
				"Mozilla/5.0",
			),
			ctx,
		)) as { blocks: unknown[] };

		const keywordRows = getTableRowsAfterContext(seoPage.blocks, "Top search keywords - 28 days");
		expect(keywordRows[0]?.keyword).toBe("emdash analytics");
		expect(JSON.stringify(seoPage.blocks)).toContain("Indexed pages overview");
		expect(JSON.stringify(seoPage.blocks)).toContain("110");
		expect(http.fetch).toHaveBeenCalled();
	});

	it("falls back to the current request origin when Search Console property is blank", async () => {
		const ctx = createContext();
		const adminHandler = statisticsSandbox.routes.admin.handler;
		const http = ctx.http as HttpStub;
		const requestUrl = "https://customer-site.example/_emdash/api/plugins/statistics-em";

		http.fetch.mockImplementation(async (url: string) => {
			if (url.includes("sites/https%3A%2F%2Fcustomer-site.example/searchAnalytics/query")) {
				return new Response(JSON.stringify({ rows: [] }), { status: 200 });
			}
			if (url.includes("sites/https%3A%2F%2Fcustomer-site.example/sitemaps")) {
				return new Response(JSON.stringify({ sitemap: [] }), { status: 200 });
			}
			throw new Error(`Unexpected URL: ${url}`);
		});

		await adminHandler(
			createRouteContext(
				{
					type: "form_submit",
					action_id: "save_seo_settings",
					values: {
						searchConsoleEnabled: true,
						searchConsoleProperty: "",
						searchConsoleAccessToken: "ya29.dynamic-token",
					},
				},
				"Mozilla/5.0",
				{ requestUrl },
			),
			ctx,
		);

		const seoPage = (await adminHandler(
			createRouteContext(
				{
					type: "block_action",
					action_id: "tab:seo",
				},
				"Mozilla/5.0",
				{ requestUrl },
			),
			ctx,
		)) as { blocks: unknown[] };

		expect(JSON.stringify(seoPage.blocks)).toContain("https://customer-site.example");
		expect(http.fetch).toHaveBeenCalled();
	});
});
