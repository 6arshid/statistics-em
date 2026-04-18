import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import {
	localizeStatisticsValue,
	resolveStatisticsLocale,
	translateStatisticsText,
} from "./i18n.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type TrafficSource = "direct" | "search" | "social" | "referral" | "paid";
type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
type ContentKind = "post" | "page";
type Tab =
	| "overview"
	| "live"
	| "traffic"
	| "insights"
	| "advanced"
	| "sessions"
	| "devices"
	| "content"
	| "seo"
	| "reports"
	| "settings";
type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly" | "custom";
type BlockInteraction =
	| { type: "page_load"; page: string }
	| { type: "block_action"; action_id: string };

interface ContentCounts {
	v: number;
	en: number;
	ex: number;
}

interface SourceCounts {
	direct: number;
	search: number;
	social: number;
	referral: number;
	paid: number;
}

interface DailyStats {
	views: number;
	uniqueSessions: number;
	newVisitors: number;
	sources: SourceCounts;
}

interface Session {
	id: string;
	visitorId: string;
	date: string;
	startTime: number;
	lastSeen: number;
	pageViews: number;
	isNew: boolean;
	source: TrafficSource;
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
	// Device analytics
	deviceType?: DeviceType;
	browser?: string;
	browserVersion?: string;
	os?: string;
	osVersion?: string;
	deviceBrand?: string;
	deviceModel?: string;
	screenWidth?: number;
	screenHeight?: number;
	// Content analytics
	entryPage?: string;
	exitPage?: string;
	lastContentKind?: ContentKind;
	maxScrollDepth?: number;
	visitedPages?: string[];
	recordingEventCount?: number;
	recordingUpdatedAt?: number;
	experiments?: Record<string, string>;
}

interface ContentDay {
	urls: Record<string, ContentCounts>;
	posts: Record<string, ContentCounts>;
	pages: Record<string, ContentCounts>;
	cats: Record<string, number>;
	tags: Record<string, number>;
	authors: Record<string, number>;
}

interface RequestMeta {
	ip: string | null;
	userAgent: string | null;
	referer: string | null;
	geo: { country: string | null; region: string | null; city: string | null } | null;
}

type RouteCtx = { input: unknown; request: Request; requestMeta: RequestMeta };

interface LiveVisitor {
	sessionId: string;
	visitorId: string;
	startedAt: number;
	lastSeen: number;
	pageUrl: string;
	referrer: string;
	source: TrafficSource;
	country: string;
	region: string;
	city: string;
}

interface SearchConsoleSettings {
	enabled: boolean;
	property: string;
	accessToken: string;
	refreshToken: string;
	clientId: string;
	clientSecret: string;
}

interface SearchConsoleKeywordRow {
	keyword: string;
	clicks: number;
	impressions: number;
	ctr: string;
	position: string;
}

interface SearchConsoleSitemapRow {
	path: string;
	submitted: number;
	indexed: number;
	lastSubmitted: string;
	type: string;
	errors: string;
	warnings: string;
}

interface SearchConsoleSnapshot {
	fetchedAt: string;
	totals: {
		clicks: number;
		impressions: number;
		ctr: number;
		position: number;
	};
	keywords: SearchConsoleKeywordRow[];
	sitemaps: SearchConsoleSitemapRow[];
	error?: string;
}

interface AnalyticsData {
	liveCount: number;
	liveVisitors: LiveVisitor[];
	todayStats: DailyStats;
	yesterdayStats: DailyStats;
	totalViews30: number;
	totalSessions30: number;
	totalNew30: number;
	totalReturning30: number;
	totalSources: SourceCounts;
	sessions: Session[];
	completedSessions: Session[];
	bounceRate: number;
	avgDurationSec: number;
}

interface AutoRefreshConfig {
	everyMs: number;
	interaction: BlockInteraction;
}

interface ReportSettings {
	emailEnabled: boolean;
	emailRecipient: string;
	emailSchedule: "daily" | "weekly" | "monthly";
}

interface DashboardSettings {
	darkMode: boolean;
	minViewRole: number;
	multiSiteLabel: string;
	defaultReportPeriod: ReportPeriod;
}

interface AdvancedSettings {
	heatmapTrackingEnabled: boolean;
	scrollTrackingEnabled: boolean;
	sessionRecordingEnabled: boolean;
	funnelAnalyticsEnabled: boolean;
	funnelSteps: string[];
	abTestingEnabled: boolean;
	abExperiments: string;
	cohortAnalysisEnabled: boolean;
}

interface AlertSettings {
	viewsEnabled: boolean;
	viewsThreshold: number;
	viewsRecipient: string;
	bounceEnabled: boolean;
	bounceThreshold: number;
	bounceRecipient: string;
	newRecordEnabled: boolean;
	newRecordRecipient: string;
}

interface HeatmapDay {
	pages: Record<
		string,
		{
			clicks: number;
			zones: Record<string, number>;
		}
	>;
}

interface ScrollDay {
	pages: Record<
		string,
		{
			views: number;
			totalDepth: number;
			maxDepth: number;
			buckets: Record<string, number>;
		}
	>;
}

interface RecordingEvent {
	type: "navigate" | "scroll" | "click";
	at: number;
	page: string;
	depth?: number;
	x?: number;
	y?: number;
	target?: string;
}

function getStatisticsLocale(ctx: PluginContext, request?: Request) {
	return resolveStatisticsLocale(request, ctx.site.locale);
}

function localizeStatisticsPayload<T>(ctx: PluginContext, value: T, request?: Request): T {
	return localizeStatisticsValue(getStatisticsLocale(ctx, request), value);
}

interface SessionRecording {
	sessionId: string;
	visitorId: string;
	startedAt: number;
	updatedAt: number;
	pages: string[];
	events: RecordingEvent[];
}

interface ExperimentConfig {
	id: string;
	pathPrefix: string;
	goalPath: string;
	variants: string[];
}

// ── Classification ────────────────────────────────────────────────────────────

const RE_SEARCH =
	/google\.|bing\.com|yahoo\.|duckduckgo\.com|baidu\.com|yandex\.|ecosia\.org|ask\.com|aol\.com|startpage\.com/i;
const RE_SOCIAL =
	/facebook\.com|fb\.com|twitter\.com|x\.com|t\.co|instagram\.com|linkedin\.com|tiktok\.com|pinterest\.com|reddit\.com|youtube\.com|snapchat\.com|telegram\.org|whatsapp\.com/i;
const RE_BUILD_SUFFIX = /\s+Build\/.*$/i;
const RE_MULTI_SPACE = /\s+/g;
const RE_IPHONE = /iPhone/;
const RE_IPAD = /iPad/;
const RE_MACINTOSH = /Macintosh/;
const RE_PIXEL_DEVICE = /\b(Pixel(?: [A-Za-z0-9]+)+)\b/i;
const RE_UA_PARENS = /\(([^)]+)\)/;
const RE_DEVICE_NOISE = /^(linux|android\b|mobile|tablet|wv)$/i;
const RE_LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const RE_LAYOUT_NOISE = /^(khtml|like gecko)$/i;
const RE_WINDOWS_10 = /Windows NT 10\.0/;
const RE_WINDOWS_81 = /Windows NT 6\.3/;
const RE_WINDOWS_7 = /Windows NT 6\.1/;
const RE_WINDOWS = /Windows/;
const RE_ANDROID_VERSION = /Android ([\d.]+)/;
const RE_SAMSUNG = /Samsung|SM-/;
const RE_GOOGLE_DEVICE = /Pixel|Nexus/;
const RE_HUAWEI = /Huawei|HUAWEI/;
const RE_XIAOMI = /Xiaomi|Redmi|MIUI/;
const RE_OPPO = /OPPO/;
const RE_ONEPLUS = /OnePlus/;
const RE_NOKIA = /Nokia/;
const RE_LG = /LG-/;
const RE_VIVO = /vivo/;
const RE_ASUS = /ASUS/;
const RE_MOTOROLA = /Motorola|moto/;
const RE_SONY = /Sony/;
const RE_IPHONE_OS = /iPhone OS ([\d_]+)/;
const RE_IPAD_OS = /CPU OS ([\d_]+)/;
const RE_MAC_OS = /Mac OS X ([\d_.]+)/;
const RE_CROS = /CrOS/;
const RE_LINUX = /Linux/;
const RE_EDGE = /Edg\/([\d.]+)/;
const RE_OPERA = /OPR\/([\d.]+)/;
const RE_SAMSUNG_BROWSER = /SamsungBrowser\/([\d.]+)/;
const RE_CHROME = /Chrome\/([\d.]+)/;
const RE_CHROMIUM = /Chromium/;
const RE_FIREFOX = /Firefox\/([\d.]+)/;
const RE_SAFARI = /Safari\//;
const RE_VERSION = /Version\/([\d.]+)/;
const RE_CHROMIUM_VERSION = /Chromium\/([\d.]+)/;
const RE_WWW_PREFIX = /^www\./;
const RE_UNDERSCORES = /_/g;
const RE_CSV_SPLIT = /[,\n]/;
const RE_EXPERIMENT_SPLIT = /[;\n]/;
const ANALYTICS_AUTO_REFRESH_MS = 15 * 1000;
const LIVE_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;
const LIVE_RETENTION_WINDOW_MS = 10 * 60 * 1000;
const SEARCH_CONSOLE_CACHE_MS = 15 * 60 * 1000;

function classifySource(ref: string, utmMedium: string, siteOrigin = ""): TrafficSource {
	const med = utmMedium.toLowerCase();
	if (med === "cpc" || med === "paid" || med === "ppc" || med === "paidsearch" || med === "display")
		return "paid";
	if (isInternalReferrer(ref, siteOrigin)) return "direct";
	if (!ref) return "direct";
	if (RE_SEARCH.test(ref)) return "search";
	if (RE_SOCIAL.test(ref)) return "social";
	return "referral";
}

function emptySourceCounts(): SourceCounts {
	return { direct: 0, search: 0, social: 0, referral: 0, paid: 0 };
}

function emptyContentCounts(): ContentCounts {
	return { v: 0, en: 0, ex: 0 };
}

function updateContentCounts(
	record: Record<string, ContentCounts>,
	key: string,
	delta: Partial<ContentCounts>,
): void {
	const current = record[key] ?? emptyContentCounts();
	record[key] = {
		v: current.v + (delta.v ?? 0),
		en: current.en + (delta.en ?? 0),
		ex: current.ex + (delta.ex ?? 0),
	};
}

function contentBucket(day: ContentDay, kind: ContentKind): Record<string, ContentCounts> {
	return kind === "post" ? day.posts : day.pages;
}

function classifyContentKind(input: {
	pgType?: string;
	pgAuth?: string;
	pgCat?: string;
	pgTags?: string[];
}): ContentKind {
	const pgType = input.pgType?.toLowerCase().trim() ?? "";
	if (pgType === "article" || pgType === "blog" || pgType === "post") return "post";
	if (pgType === "website" || pgType === "page") return "page";
	if (input.pgAuth || input.pgCat || (input.pgTags?.length ?? 0) > 0) return "post";
	return "page";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(input: Record<string, unknown>, key: string): string {
	return typeof input[key] === "string" ? input[key].trim() : "";
}

function getBoolean(input: Record<string, unknown>, key: string, fallback = false): boolean {
	return typeof input[key] === "boolean" ? input[key] : fallback;
}

function getStringArray(input: Record<string, unknown>, key: string): string[] {
	const raw = getString(input, key);
	if (!raw) return [];
	return raw
		.split(RE_CSV_SPLIT)
		.map((value) => value.trim())
		.filter(Boolean);
}

// Only allow alphanumeric + hyphen chars to prevent KV key injection
const RE_SAFE_ID = /^[a-z0-9_-]{1,64}$/i;
function isSafeId(value: unknown): value is string {
	return typeof value === "string" && RE_SAFE_ID.test(value);
}

function truncate(value: string, max: number): string {
	return value.length > max ? value.slice(0, max) : value;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value: string): boolean {
	return RE_EMAIL.test(value) && value.length <= 254;
}

const RE_DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
function isSafeDateKey(value: string): boolean {
	if (!RE_DATE_KEY.test(value)) return false;
	const d = new Date(value);
	return !Number.isNaN(d.getTime());
}

const VALID_DEVICE_TYPES = new Set(["desktop", "mobile", "tablet", "unknown"]);
const VALID_REPORT_PERIODS = new Set(["daily", "weekly", "monthly", "yearly", "custom"]);

function clampPercent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, Math.round(value)));
}

function appendVisitedPage(pages: string[] | undefined, page: string): string[] {
	if (!page) return pages ?? [];
	if (!pages || pages.length === 0) return [page];
	if (pages.at(-1) === page) return pages;
	return [...pages, page];
}

function normalizeZoneIndex(value: number): number {
	return Math.max(0, Math.min(4, Math.floor(value * 5)));
}

function zoneLabelFromCoordinates(x: number, y: number): string {
	return `${normalizeZoneIndex(x)}:${normalizeZoneIndex(y)}`;
}

function formatZoneLabel(zone: string): string {
	const [xRaw, yRaw] = zone.split(":");
	const x = Number.parseInt(xRaw ?? "0", 10);
	const y = Number.parseInt(yRaw ?? "0", 10);
	return `col ${x + 1}, row ${y + 1}`;
}

function summarizeRecordingEvent(event: RecordingEvent): string {
	if (event.type === "scroll") return `Scroll ${clampPercent(event.depth ?? 0)}%`;
	if (event.type === "click")
		return `Click ${clampPercent((event.x ?? 0) * 100)}% / ${clampPercent((event.y ?? 0) * 100)}%`;
	return `Navigate ${event.page}`;
}

function stableBucket(input: string, modulo: number): number {
	let hash = 0;
	for (const char of input) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return modulo > 0 ? hash % modulo : 0;
}

function startOfIsoWeek(dateKey: string): string {
	const date = new Date(`${dateKey}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return dateKey;
	const day = date.getUTCDay() || 7;
	date.setUTCDate(date.getUTCDate() - day + 1);
	return date.toISOString().slice(0, 10);
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isLiveVisitor(value: unknown): value is LiveVisitor {
	if (!isRecord(value)) return false;
	return (
		typeof value.sessionId === "string" &&
		typeof value.visitorId === "string" &&
		typeof value.pageUrl === "string" &&
		typeof value.referrer === "string" &&
		typeof value.source === "string" &&
		typeof value.country === "string" &&
		typeof value.region === "string" &&
		typeof value.city === "string" &&
		asNumber(value.startedAt) !== null &&
		asNumber(value.lastSeen) !== null
	);
}

function resolveSiteOrigin(ctx: PluginContext, request?: Request): string {
	const candidates = [request?.url ?? "", ctx.site.url];
	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			const parsed = new URL(candidate);
			if (parsed.protocol === "http:" || parsed.protocol === "https:") {
				return parsed.origin;
			}
		} catch {
			// Ignore invalid candidates and try the next source.
		}
	}
	return "";
}

function isInternalReferrer(referrer: string, siteOrigin: string): boolean {
	if (!referrer || !siteOrigin) return false;
	try {
		return new URL(referrer).origin === siteOrigin;
	} catch {
		return false;
	}
}

function referrerDomain(referrer: string, siteOrigin = ""): string {
	if (!referrer || isInternalReferrer(referrer, siteOrigin)) return "Direct";
	try {
		return new URL(referrer).hostname.replace(RE_WWW_PREFIX, "") || "Direct";
	} catch {
		return referrer;
	}
}

function normalizeTrackedPath(rawUrl: string, siteOrigin: string): string {
	const value = rawUrl.trim();
	if (!value) return "";
	if (value.startsWith("/")) return value;
	try {
		const parsed = new URL(value);
		if (!siteOrigin || parsed.origin === siteOrigin) {
			return parsed.pathname || "/";
		}
	} catch {
		// Fall through and keep the original value.
	}
	return value;
}

function hasVisitedPath(session: Session, path: string): boolean {
	if (!path) return false;
	if (session.entryPage === path || session.exitPage === path) return true;
	return (session.visitedPages ?? []).includes(path);
}

function resolveSearchConsoleProperty(settings: SearchConsoleSettings, siteOrigin: string): string {
	return settings.property || siteOrigin;
}

function formatLocation(city: string, region: string, country: string): string {
	return [city, region, country].filter(Boolean).join(", ") || "Unknown";
}

// ── UA Parsing ────────────────────────────────────────────────────────────────

interface DeviceInfo {
	browser: string;
	browserVersion: string;
	os: string;
	osVersion: string;
	deviceBrand: string;
	deviceModel: string;
}

function cleanDeviceModel(model: string): string {
	return model.replace(RE_BUILD_SUFFIX, "").replace(RE_MULTI_SPACE, " ").trim();
}

function extractDeviceModel(ua: string): string {
	if (RE_IPHONE.test(ua)) return "iPhone";
	if (RE_IPAD.test(ua)) return "iPad";
	if (RE_MACINTOSH.test(ua)) return "Mac";

	const pixelMatch = ua.match(RE_PIXEL_DEVICE);
	if (pixelMatch?.[1]) return cleanDeviceModel(pixelMatch[1]);

	const parenMatch = ua.match(RE_UA_PARENS);
	const parts = parenMatch?.[1]
		?.split(";")
		.map((part) => cleanDeviceModel(part))
		.filter((part) => {
			if (!part) return false;
			if (part.length < 3) return false;
			if (RE_DEVICE_NOISE.test(part)) return false;
			if (RE_LOCALE.test(part)) return false;
			return true;
		});

	if (!parts?.length) return "";

	for (let i = parts.length - 1; i >= 0; i -= 1) {
		const candidate = parts[i];
		if (!candidate || RE_LAYOUT_NOISE.test(candidate)) continue;
		return candidate;
	}

	return "";
}

function parseUA(ua: string): DeviceInfo {
	if (!ua) {
		return {
			browser: "Unknown",
			browserVersion: "",
			os: "Unknown",
			osVersion: "",
			deviceBrand: "",
			deviceModel: "",
		};
	}

	let os = "Unknown",
		osVersion = "",
		deviceBrand = "",
		deviceModel = extractDeviceModel(ua);

	if (RE_WINDOWS_10.test(ua)) {
		os = "Windows";
		osVersion = "10/11";
	} else if (RE_WINDOWS_81.test(ua)) {
		os = "Windows";
		osVersion = "8.1";
	} else if (RE_WINDOWS_7.test(ua)) {
		os = "Windows";
		osVersion = "7";
	} else if (RE_WINDOWS.test(ua)) {
		os = "Windows";
	} else if (RE_ANDROID_VERSION.test(ua)) {
		os = "Android";
		const m = ua.match(RE_ANDROID_VERSION);
		osVersion = m?.[1]?.split(".").slice(0, 2).join(".") ?? "";
		if (RE_SAMSUNG.test(ua)) deviceBrand = "Samsung";
		else if (RE_GOOGLE_DEVICE.test(ua)) deviceBrand = "Google";
		else if (RE_HUAWEI.test(ua)) deviceBrand = "Huawei";
		else if (RE_XIAOMI.test(ua)) deviceBrand = "Xiaomi";
		else if (RE_OPPO.test(ua)) deviceBrand = "OPPO";
		else if (RE_ONEPLUS.test(ua)) deviceBrand = "OnePlus";
		else if (RE_NOKIA.test(ua)) deviceBrand = "Nokia";
		else if (RE_LG.test(ua)) deviceBrand = "LG";
		else if (RE_VIVO.test(ua)) deviceBrand = "Vivo";
		else if (RE_ASUS.test(ua)) deviceBrand = "ASUS";
		else if (RE_MOTOROLA.test(ua)) deviceBrand = "Motorola";
		else if (RE_SONY.test(ua)) deviceBrand = "Sony";
	} else if (RE_IPHONE.test(ua)) {
		os = "iOS";
		const m = ua.match(RE_IPHONE_OS);
		osVersion = m?.[1]?.replace(RE_UNDERSCORES, ".").split(".").slice(0, 2).join(".") ?? "";
		deviceBrand = "Apple";
		deviceModel = "iPhone";
	} else if (RE_IPAD.test(ua)) {
		os = "iPadOS";
		const m = ua.match(RE_IPAD_OS);
		osVersion = m?.[1]?.replace(RE_UNDERSCORES, ".").split(".").slice(0, 2).join(".") ?? "";
		deviceBrand = "Apple";
		deviceModel = "iPad";
	} else if (RE_MAC_OS.test(ua)) {
		os = "macOS";
		const m = ua.match(RE_MAC_OS);
		osVersion = m?.[1]?.replace(RE_UNDERSCORES, ".").split(".").slice(0, 2).join(".") ?? "";
		deviceBrand = "Apple";
		deviceModel = "Mac";
	} else if (RE_CROS.test(ua)) {
		os = "Chrome OS";
	} else if (RE_LINUX.test(ua)) {
		os = "Linux";
	}

	let browser = "Unknown",
		browserVersion = "";
	if (RE_EDGE.test(ua)) {
		browser = "Edge";
		const m = ua.match(RE_EDGE);
		browserVersion = m?.[1]?.split(".")[0] ?? "";
	} else if (RE_OPERA.test(ua)) {
		browser = "Opera";
		const m = ua.match(RE_OPERA);
		browserVersion = m?.[1]?.split(".")[0] ?? "";
	} else if (RE_SAMSUNG_BROWSER.test(ua)) {
		browser = "Samsung Browser";
		const m = ua.match(RE_SAMSUNG_BROWSER);
		browserVersion = m?.[1]?.split(".")[0] ?? "";
	} else if (RE_CHROME.test(ua) && !RE_CHROMIUM.test(ua)) {
		browser = "Chrome";
		const m = ua.match(RE_CHROME);
		browserVersion = m?.[1]?.split(".")[0] ?? "";
	} else if (RE_FIREFOX.test(ua)) {
		browser = "Firefox";
		const m = ua.match(RE_FIREFOX);
		browserVersion = m?.[1]?.split(".")[0] ?? "";
	} else if (RE_SAFARI.test(ua) && RE_VERSION.test(ua)) {
		browser = "Safari";
		const m = ua.match(RE_VERSION);
		browserVersion = m?.[1]?.split(".")[0] ?? "";
	} else if (RE_CHROMIUM_VERSION.test(ua)) {
		browser = "Chromium";
		const m = ua.match(RE_CHROMIUM_VERSION);
		browserVersion = m?.[1]?.split(".")[0] ?? "";
	}

	return { browser, browserVersion, os, osVersion, deviceBrand, deviceModel };
}

// ── Crypto & Date ─────────────────────────────────────────────────────────────

async function hashIp(ip: string): Promise<string> {
	const data = new TextEncoder().encode(ip + ":statistics-em");
	const buf = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 16);
}

function getDateKey(offsetDays = 0): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - offsetDays);
	return d.toISOString().split("T")[0]!;
}

function getLast30Days(): string[] {
	return Array.from({ length: 30 }, (_, i) => getDateKey(29 - i));
}

function getLastNDays(n: number): string[] {
	return Array.from({ length: n }, (_, i) => getDateKey(n - 1 - i));
}

function dateRangeDays(from: string, to: string): string[] {
	const result: string[] = [];
	const end = new Date(to + "T00:00:00Z");
	for (let current = new Date(from + "T00:00:00Z"); current <= end; ) {
		result.push(current.toISOString().split("T")[0]!);
		current = new Date(current);
		current.setUTCDate(current.getUTCDate() + 1);
	}
	return result;
}

function weekStartOf(date: string): string {
	const d = new Date(date + "T00:00:00Z");
	const day = d.getUTCDay();
	d.setUTCDate(d.getUTCDate() - day);
	return d.toISOString().split("T")[0]!;
}

function monthOf(date: string): string {
	return date.slice(0, 7);
}

function yearOf(date: string): string {
	return date.slice(0, 4);
}

function aggregatePeriod(
	days: { date: string; s: DailyStats }[],
	keyFn: (date: string) => string,
): { label: string; s: DailyStats }[] {
	const map = new Map<string, DailyStats>();
	for (const { date, s } of days) {
		const key = keyFn(date);
		const existing = map.get(key) ?? {
			views: 0,
			uniqueSessions: 0,
			newVisitors: 0,
			sources: emptySourceCounts(),
		};
		map.set(key, {
			views: existing.views + s.views,
			uniqueSessions: existing.uniqueSessions + s.uniqueSessions,
			newVisitors: existing.newVisitors + s.newVisitors,
			sources: {
				direct: existing.sources.direct + (s.sources?.direct ?? 0),
				search: existing.sources.search + (s.sources?.search ?? 0),
				social: existing.sources.social + (s.sources?.social ?? 0),
				referral: existing.sources.referral + (s.sources?.referral ?? 0),
				paid: existing.sources.paid + (s.sources?.paid ?? 0),
			},
		});
	}
	return sortItems(map.entries(), (a, b) => a[0].localeCompare(b[0])).map(([label, s]) => ({
		label,
		s,
	}));
}

function getReportDays(period: ReportPeriod, dateFrom?: string, dateTo?: string): string[] {
	switch (period) {
		case "weekly":
			return getLastNDays(84);
		case "monthly":
			return getLastNDays(365);
		case "yearly":
			return getLastNDays(730);
		case "custom":
			return dateFrom && dateTo ? dateRangeDays(dateFrom, dateTo) : getLastNDays(30);
		default:
			return getLastNDays(30);
	}
}

function aggregateForPeriod(
	rawData: { date: string; s: DailyStats }[],
	period: ReportPeriod,
): { label: string; s: DailyStats }[] {
	switch (period) {
		case "weekly":
			return aggregatePeriod(rawData, weekStartOf);
		case "monthly":
			return aggregatePeriod(rawData, monthOf);
		case "yearly":
			return aggregatePeriod(rawData, yearOf);
		default:
			return rawData.map(({ date, s }) => ({ label: date, s }));
	}
}

function labelToTimestamp(label: string): number {
	if (label.length === 4) return new Date(label + "-01-01T00:00:00Z").getTime();
	if (label.length === 7) return new Date(label + "-01T00:00:00Z").getTime();
	return new Date(label + "T00:00:00Z").getTime();
}

// ── KV Helpers ────────────────────────────────────────────────────────────────

async function getDailyStats(ctx: PluginContext, date: string): Promise<DailyStats> {
	return (
		(await ctx.kv.get<DailyStats>(`daily:${date}`)) ?? {
			views: 0,
			uniqueSessions: 0,
			newVisitors: 0,
			sources: emptySourceCounts(),
		}
	);
}

async function getContentDay(ctx: PluginContext, date: string): Promise<ContentDay> {
	return (
		(await ctx.kv.get<ContentDay>(`pvday:${date}`)) ?? {
			urls: {},
			posts: {},
			pages: {},
			cats: {},
			tags: {},
			authors: {},
		}
	);
}

async function getHeatmapDay(ctx: PluginContext, date: string): Promise<HeatmapDay> {
	return (
		(await ctx.kv.get<HeatmapDay>(`heat:${date}`)) ?? {
			pages: {},
		}
	);
}

async function getScrollDay(ctx: PluginContext, date: string): Promise<ScrollDay> {
	return (
		(await ctx.kv.get<ScrollDay>(`scroll:${date}`)) ?? {
			pages: {},
		}
	);
}

function isRecordingEvent(value: unknown): value is RecordingEvent {
	if (!isRecord(value)) return false;
	return (
		(value.type === "navigate" || value.type === "scroll" || value.type === "click") &&
		typeof value.page === "string" &&
		value.page.length <= 1024 &&
		asNumber(value.at) !== null
	);
}

function isSessionRecording(value: unknown): value is SessionRecording {
	return (
		isRecord(value) &&
		typeof value.sessionId === "string" &&
		typeof value.visitorId === "string" &&
		asNumber(value.startedAt) !== null &&
		asNumber(value.updatedAt) !== null &&
		Array.isArray(value.pages) &&
		Array.isArray(value.events) &&
		value.events.every((event) => isRecordingEvent(event))
	);
}

async function getStoredLiveVisitors(ctx: PluginContext): Promise<Record<string, LiveVisitor>> {
	const raw = (await ctx.kv.get<Record<string, unknown>>("live")) ?? {};
	const live: Record<string, LiveVisitor> = {};
	const cutoff = Date.now() - LIVE_RETENTION_WINDOW_MS;

	for (const [key, value] of Object.entries(raw)) {
		if (!isLiveVisitor(value)) continue;
		if (value.lastSeen < cutoff) continue;
		live[key] = value;
	}

	if (Object.keys(live).length !== Object.keys(raw).length) {
		await ctx.kv.set("live", live);
	}

	return live;
}

async function getLiveVisitors(ctx: PluginContext): Promise<LiveVisitor[]> {
	return sortItems(
		Object.values(await getStoredLiveVisitors(ctx)),
		(a, b) => b.lastSeen - a.lastSeen,
	);
}

async function getActiveLiveVisitors(ctx: PluginContext): Promise<LiveVisitor[]> {
	const cutoff = Date.now() - LIVE_ACTIVITY_WINDOW_MS;
	return (await getLiveVisitors(ctx)).filter((visitor) => visitor.lastSeen >= cutoff);
}

async function getLiveCount(ctx: PluginContext): Promise<number> {
	return (await getActiveLiveVisitors(ctx)).length;
}

async function upsertLive(ctx: PluginContext, liveVisitor: LiveVisitor): Promise<void> {
	const live = await getStoredLiveVisitors(ctx);
	live[liveVisitor.sessionId] = liveVisitor;
	await ctx.kv.set("live", live);
}

async function removeLiveVisitor(ctx: PluginContext, sessionId: string): Promise<void> {
	const live = await getStoredLiveVisitors(ctx);
	delete live[sessionId];
	await ctx.kv.set("live", live);
}

async function getSearchConsoleSettings(ctx: PluginContext): Promise<SearchConsoleSettings> {
	return {
		enabled: (await ctx.kv.get<boolean>("settings:searchConsoleEnabled")) ?? false,
		property: ((await ctx.kv.get<string>("settings:searchConsoleProperty")) ?? "").trim(),
		accessToken: ((await ctx.kv.get<string>("settings:searchConsoleAccessToken")) ?? "").trim(),
		refreshToken: ((await ctx.kv.get<string>("settings:searchConsoleRefreshToken")) ?? "").trim(),
		clientId: ((await ctx.kv.get<string>("settings:searchConsoleClientId")) ?? "").trim(),
		clientSecret: ((await ctx.kv.get<string>("settings:searchConsoleClientSecret")) ?? "").trim(),
	};
}

function ensureHttp(ctx: PluginContext) {
	if (!ctx.http) {
		throw new Error("Search Console integration requires network:fetch capability");
	}
	return ctx.http;
}

async function refreshSearchConsoleAccessToken(
	ctx: PluginContext,
	settings: SearchConsoleSettings,
): Promise<string> {
	if (!settings.refreshToken || !settings.clientId || !settings.clientSecret) {
		if (settings.accessToken) return settings.accessToken;
		throw new Error("Provide an access token or OAuth refresh credentials");
	}

	const response = await ensureHttp(ctx).fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: settings.clientId,
			client_secret: settings.clientSecret,
			refresh_token: settings.refreshToken,
			grant_type: "refresh_token",
		}).toString(),
	});

	if (!response.ok) {
		throw new Error(`Token refresh failed with HTTP ${response.status}`);
	}

	const body = (await response.json()) as { access_token?: string; expires_in?: number };
	if (!body.access_token) throw new Error("Token refresh did not return an access token");

	await ctx.kv.set("settings:searchConsoleAccessToken", body.access_token);
	if (typeof body.expires_in === "number") {
		await ctx.kv.set(
			"state:searchConsoleAccessTokenExpiresAt",
			Date.now() + Math.max(body.expires_in - 60, 60) * 1000,
		);
	}

	return body.access_token;
}

async function getSearchConsoleAccessToken(
	ctx: PluginContext,
	settings: SearchConsoleSettings,
	forceRefresh = false,
): Promise<string> {
	const expiresAt = (await ctx.kv.get<number>("state:searchConsoleAccessTokenExpiresAt")) ?? 0;
	if (!forceRefresh && settings.accessToken && expiresAt > Date.now()) {
		return settings.accessToken;
	}
	if (!forceRefresh && settings.accessToken && !settings.refreshToken) {
		return settings.accessToken;
	}
	return refreshSearchConsoleAccessToken(ctx, settings);
}

async function fetchSearchConsoleJson<T>(
	ctx: PluginContext,
	url: string,
	token: string,
	init?: RequestInit,
): Promise<T> {
	const headers = new Headers(init?.headers);
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("Accept", "application/json");

	const response = await ensureHttp(ctx).fetch(url, {
		...init,
		headers,
	});

	if (!response.ok) {
		throw new Error(`Search Console request failed with HTTP ${response.status}`);
	}

	return (await response.json()) as T;
}

async function loadFreshSearchConsoleSnapshot(
	ctx: PluginContext,
	request?: Request,
): Promise<SearchConsoleSnapshot> {
	const settings = await getSearchConsoleSettings(ctx);
	const property = resolveSearchConsoleProperty(settings, resolveSiteOrigin(ctx, request));
	if (!settings.enabled || !property) {
		throw new Error("Enable Search Console and provide a property first");
	}

	const site = encodeURIComponent(property);
	let token = await getSearchConsoleAccessToken(ctx, settings);

	const run = async (accessToken: string) => {
		const base = `https://www.googleapis.com/webmasters/v3/sites/${site}`;
		const endDate = getDateKey(0);
		const startDate = getDateKey(27);

		const [totals, keywords, sitemaps] = await Promise.all([
			fetchSearchConsoleJson<{
				rows?: Array<{ clicks?: number; impressions?: number; ctr?: number; position?: number }>;
			}>(ctx, `${base}/searchAnalytics/query`, accessToken, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					startDate,
					endDate,
					rowLimit: 1,
					searchType: "web",
				}),
			}),
			fetchSearchConsoleJson<{
				rows?: Array<{
					keys?: string[];
					clicks?: number;
					impressions?: number;
					ctr?: number;
					position?: number;
				}>;
			}>(ctx, `${base}/searchAnalytics/query`, accessToken, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					startDate,
					endDate,
					rowLimit: 25,
					searchType: "web",
					dimensions: ["query"],
				}),
			}),
			fetchSearchConsoleJson<{
				sitemap?: Array<{
					path?: string;
					lastSubmitted?: string;
					type?: string;
					errors?: string;
					warnings?: string;
					contents?: Array<{ type?: string; submitted?: number; indexed?: number }>;
				}>;
			}>(ctx, `${base}/sitemaps`, accessToken),
		]);

		const totalRow = totals.rows?.[0];
		const keywordRows =
			keywords.rows?.map((row) => ({
				keyword: row.keys?.[0] ?? "(not provided)",
				clicks: Math.round(row.clicks ?? 0),
				impressions: Math.round(row.impressions ?? 0),
				ctr: pct(row.clicks ?? 0, row.impressions ?? 0),
				position: (row.position ?? 0).toFixed(1),
			})) ?? [];
		const sitemapRows =
			sitemaps.sitemap?.map((sitemap) => {
				const firstContent = sitemap.contents?.[0];
				return {
					path: sitemap.path ?? "",
					submitted: Math.round(firstContent?.submitted ?? 0),
					indexed: Math.round(firstContent?.indexed ?? 0),
					lastSubmitted: sitemap.lastSubmitted ?? "",
					type: firstContent?.type ?? sitemap.type ?? "web",
					errors: sitemap.errors ?? "0",
					warnings: sitemap.warnings ?? "0",
				};
			}) ?? [];

		return {
			fetchedAt: new Date().toISOString(),
			totals: {
				clicks: Math.round(totalRow?.clicks ?? 0),
				impressions: Math.round(totalRow?.impressions ?? 0),
				ctr: totalRow?.ctr ?? 0,
				position: totalRow?.position ?? 0,
			},
			keywords: keywordRows,
			sitemaps: sitemapRows,
		} satisfies SearchConsoleSnapshot;
	};

	try {
		return await run(token);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("HTTP 401")) throw error;
		token = await getSearchConsoleAccessToken(ctx, settings, true);
		return run(token);
	}
}

async function getSearchConsoleSnapshot(
	ctx: PluginContext,
	forceRefresh = false,
	request?: Request,
): Promise<SearchConsoleSnapshot | null> {
	const settings = await getSearchConsoleSettings(ctx);
	if (
		!settings.enabled ||
		!resolveSearchConsoleProperty(settings, resolveSiteOrigin(ctx, request))
	) {
		return null;
	}

	const cached = await ctx.kv.get<SearchConsoleSnapshot>("state:searchConsoleSnapshot");
	const isFresh =
		!!cached && Date.now() - new Date(cached.fetchedAt).getTime() < SEARCH_CONSOLE_CACHE_MS;
	if (!forceRefresh && cached && isFresh) return cached;

	try {
		const snapshot = await loadFreshSearchConsoleSnapshot(ctx, request);
		await ctx.kv.set("state:searchConsoleSnapshot", snapshot);
		await ctx.kv.delete("state:searchConsoleError");
		return snapshot;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await ctx.kv.set("state:searchConsoleError", message);
		if (cached) return { ...cached, error: message };
		return {
			fetchedAt: new Date().toISOString(),
			totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
			keywords: [],
			sitemaps: [],
			error: message,
		};
	}
}

async function saveSearchConsoleSettings(
	ctx: PluginContext,
	values: Record<string, unknown>,
): Promise<void> {
	await ctx.kv.set("settings:searchConsoleEnabled", getBoolean(values, "searchConsoleEnabled"));
	await ctx.kv.set("settings:searchConsoleProperty", getString(values, "searchConsoleProperty"));
	await ctx.kv.set("settings:searchConsoleClientId", getString(values, "searchConsoleClientId"));
	if (
		typeof values.searchConsoleClientSecret === "string" &&
		values.searchConsoleClientSecret.trim()
	) {
		await ctx.kv.set("settings:searchConsoleClientSecret", values.searchConsoleClientSecret.trim());
	}
	if (
		typeof values.searchConsoleRefreshToken === "string" &&
		values.searchConsoleRefreshToken.trim()
	) {
		await ctx.kv.set("settings:searchConsoleRefreshToken", values.searchConsoleRefreshToken.trim());
	}
	if (
		typeof values.searchConsoleAccessToken === "string" &&
		values.searchConsoleAccessToken.trim()
	) {
		await ctx.kv.set("settings:searchConsoleAccessToken", values.searchConsoleAccessToken.trim());
		await ctx.kv.delete("state:searchConsoleAccessTokenExpiresAt");
	}
	await ctx.kv.delete("state:searchConsoleSnapshot");
	await ctx.kv.delete("state:searchConsoleError");
}

// ── Report Settings ───────────────────────────────────────────────────────────

async function getReportSettings(ctx: PluginContext): Promise<ReportSettings> {
	return {
		emailEnabled: (await ctx.kv.get<boolean>("settings:reportEmailEnabled")) ?? false,
		emailRecipient: ((await ctx.kv.get<string>("settings:reportEmailRecipient")) ?? "").trim(),
		emailSchedule:
			((await ctx.kv.get<string>("settings:reportEmailSchedule")) as
				| "daily"
				| "weekly"
				| "monthly") ?? "weekly",
	};
}

async function saveReportSettings(
	ctx: PluginContext,
	values: Record<string, unknown>,
): Promise<void> {
	await ctx.kv.set("settings:reportEmailEnabled", getBoolean(values, "reportEmailEnabled"));
	await ctx.kv.set("settings:reportEmailRecipient", getString(values, "reportEmailRecipient"));
	const schedule = getString(values, "reportEmailSchedule") || "weekly";
	await ctx.kv.set("settings:reportEmailSchedule", schedule);
	const cronExpr =
		schedule === "daily" ? "0 8 * * *" : schedule === "monthly" ? "0 8 1 * *" : "0 8 * * 1";
	await ctx.cron?.schedule("email-report", { schedule: cronExpr });
}

// ── Dashboard Settings ────────────────────────────────────────────────────────

async function getDashboardSettings(ctx: PluginContext): Promise<DashboardSettings> {
	return {
		darkMode: (await ctx.kv.get<boolean>("settings:darkMode")) ?? false,
		minViewRole: (await ctx.kv.get<number>("settings:minViewRole")) ?? 10,
		multiSiteLabel: ((await ctx.kv.get<string>("settings:multiSiteLabel")) ?? "").trim(),
		defaultReportPeriod:
			((await ctx.kv.get<string>("settings:defaultReportPeriod")) as ReportPeriod) ?? "daily",
	};
}

async function saveDashboardSettings(
	ctx: PluginContext,
	values: Record<string, unknown>,
): Promise<void> {
	await ctx.kv.set("settings:darkMode", getBoolean(values, "darkMode"));
	const roleRaw = getString(values, "minViewRole");
	const role = parseInt(roleRaw || "10", 10);
	await ctx.kv.set("settings:minViewRole", Number.isFinite(role) ? role : 10);
	await ctx.kv.set(
		"settings:multiSiteLabel",
		truncate(getString(values, "multiSiteLabel"), 128),
	);
	const period = getString(values, "defaultReportPeriod") || "daily";
	await ctx.kv.set(
		"settings:defaultReportPeriod",
		VALID_REPORT_PERIODS.has(period) ? period : "daily",
	);
}

async function getAdvancedSettings(ctx: PluginContext): Promise<AdvancedSettings> {
	const fallback: AdvancedSettings = {
		heatmapTrackingEnabled: true,
		scrollTrackingEnabled: true,
		sessionRecordingEnabled: false,
		funnelAnalyticsEnabled: true,
		funnelSteps: ["/", "/pricing", "/signup", "/checkout", "/thank-you"],
		abTestingEnabled: false,
		abExperiments: "pricing_test@/pricing->/signup:control,variant",
		cohortAnalysisEnabled: true,
	};
	const kv = (ctx as { kv?: PluginContext["kv"] }).kv;
	if (!kv) return fallback;
	return {
		heatmapTrackingEnabled:
			(await kv.get<boolean>("settings:heatmapTrackingEnabled")) ?? fallback.heatmapTrackingEnabled,
		scrollTrackingEnabled:
			(await kv.get<boolean>("settings:scrollTrackingEnabled")) ?? fallback.scrollTrackingEnabled,
		sessionRecordingEnabled:
			(await kv.get<boolean>("settings:sessionRecordingEnabled")) ??
			fallback.sessionRecordingEnabled,
		funnelAnalyticsEnabled:
			(await kv.get<boolean>("settings:funnelAnalyticsEnabled")) ?? fallback.funnelAnalyticsEnabled,
		funnelSteps: getStringArray(
			{
				funnelSteps:
					(await kv.get<string>("settings:funnelSteps")) ?? fallback.funnelSteps.join(","),
			},
			"funnelSteps",
		),
		abTestingEnabled:
			(await kv.get<boolean>("settings:abTestingEnabled")) ?? fallback.abTestingEnabled,
		abExperiments:
			((await kv.get<string>("settings:abExperiments")) ?? "").trim() || fallback.abExperiments,
		cohortAnalysisEnabled:
			(await kv.get<boolean>("settings:cohortAnalysisEnabled")) ?? fallback.cohortAnalysisEnabled,
	};
}

async function saveAdvancedSettings(
	ctx: PluginContext,
	values: Record<string, unknown>,
): Promise<void> {
	await ctx.kv.set(
		"settings:heatmapTrackingEnabled",
		getBoolean(values, "heatmapTrackingEnabled", true),
	);
	await ctx.kv.set(
		"settings:scrollTrackingEnabled",
		getBoolean(values, "scrollTrackingEnabled", true),
	);
	await ctx.kv.set(
		"settings:sessionRecordingEnabled",
		getBoolean(values, "sessionRecordingEnabled"),
	);
	await ctx.kv.set(
		"settings:funnelAnalyticsEnabled",
		getBoolean(values, "funnelAnalyticsEnabled", true),
	);
	await ctx.kv.set("settings:funnelSteps", getString(values, "funnelSteps"));
	await ctx.kv.set("settings:abTestingEnabled", getBoolean(values, "abTestingEnabled"));
	await ctx.kv.set("settings:abExperiments", getString(values, "abExperiments"));
	await ctx.kv.set(
		"settings:cohortAnalysisEnabled",
		getBoolean(values, "cohortAnalysisEnabled", true),
	);
}

function parseExperimentConfigs(raw: string): ExperimentConfig[] {
	return raw
		.split(RE_EXPERIMENT_SPLIT)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [rawHead = "", variantsRaw = "control,variant"] = line.split(":");
			const head = rawHead.trim();
			const [id = "", pathAndGoal = ""] = head.split("@");
			const [pathPrefix = "", goalPath = ""] = pathAndGoal.split("->");
			const variants = variantsRaw
				.split(",")
				.map((variant) => variant.trim())
				.filter(Boolean);
			if (!id || !pathPrefix || !goalPath || variants.length < 2) return null;
			return {
				id,
				pathPrefix,
				goalPath,
				variants,
			} satisfies ExperimentConfig;
		})
		.filter((config): config is ExperimentConfig => config !== null);
}

function assignExperimentVariants(
	visitorId: string,
	pageUrl: string,
	experiments: ExperimentConfig[],
): Record<string, string> {
	const assignments: Record<string, string> = {};
	for (const experiment of experiments) {
		if (!pageUrl.startsWith(experiment.pathPrefix)) continue;
		const index = stableBucket(`${visitorId}:${experiment.id}`, experiment.variants.length);
		assignments[experiment.id] = experiment.variants[index] ?? experiment.variants[0]!;
	}
	return assignments;
}

// ── Alert Settings ────────────────────────────────────────────────────────────

async function getAlertSettings(ctx: PluginContext): Promise<AlertSettings> {
	return {
		viewsEnabled: (await ctx.kv.get<boolean>("settings:alertViewsEnabled")) ?? false,
		viewsThreshold: (await ctx.kv.get<number>("settings:alertViewsThreshold")) ?? 1000,
		viewsRecipient: ((await ctx.kv.get<string>("settings:alertViewsRecipient")) ?? "").trim(),
		bounceEnabled: (await ctx.kv.get<boolean>("settings:alertBounceEnabled")) ?? false,
		bounceThreshold: (await ctx.kv.get<number>("settings:alertBounceThreshold")) ?? 70,
		bounceRecipient: ((await ctx.kv.get<string>("settings:alertBounceRecipient")) ?? "").trim(),
		newRecordEnabled: (await ctx.kv.get<boolean>("settings:alertNewRecordEnabled")) ?? false,
		newRecordRecipient: (
			(await ctx.kv.get<string>("settings:alertNewRecordRecipient")) ?? ""
		).trim(),
	};
}

async function saveAlertSettings(
	ctx: PluginContext,
	values: Record<string, unknown>,
): Promise<void> {
	await ctx.kv.set("settings:alertViewsEnabled", getBoolean(values, "alertViewsEnabled"));
	const viewsThr = parseInt(getString(values, "alertViewsThreshold") || "1000", 10);
	await ctx.kv.set("settings:alertViewsThreshold", Number.isFinite(viewsThr) ? viewsThr : 1000);
	const viewsRecipient = getString(values, "alertViewsRecipient");
	await ctx.kv.set(
		"settings:alertViewsRecipient",
		isValidEmail(viewsRecipient) ? viewsRecipient : "",
	);
	await ctx.kv.set("settings:alertBounceEnabled", getBoolean(values, "alertBounceEnabled"));
	const bounceThr = parseInt(getString(values, "alertBounceThreshold") || "70", 10);
	await ctx.kv.set("settings:alertBounceThreshold", Number.isFinite(bounceThr) ? bounceThr : 70);
	const bounceRecipient = getString(values, "alertBounceRecipient");
	await ctx.kv.set(
		"settings:alertBounceRecipient",
		isValidEmail(bounceRecipient) ? bounceRecipient : "",
	);
	await ctx.kv.set("settings:alertNewRecordEnabled", getBoolean(values, "alertNewRecordEnabled"));
	const newRecordRecipient = getString(values, "alertNewRecordRecipient");
	await ctx.kv.set(
		"settings:alertNewRecordRecipient",
		isValidEmail(newRecordRecipient) ? newRecordRecipient : "",
	);
}

async function checkAndFireAlerts(ctx: PluginContext): Promise<void> {
	if (!ctx.email) return;
	const [alerts, todayStats, sessionsResult] = await Promise.all([
		getAlertSettings(ctx),
		getDailyStats(ctx, getDateKey(0)),
		ctx.storage.sessions!.query({ where: { date: { gte: getDateKey(29) } }, limit: 2000 }),
	]);

	const promises: Promise<void>[] = [];

	if (alerts.viewsEnabled && alerts.viewsRecipient && todayStats.views >= alerts.viewsThreshold) {
		promises.push(
			ctx.email
				.send({
					to: alerts.viewsRecipient,
					subject: `[Alert] ${todayStats.views.toLocaleString()} views today — threshold reached`,
					text: [
						`Traffic Alert — ${ctx.site.url}`,
						``,
						`Today's page views: ${todayStats.views.toLocaleString()}`,
						`Alert threshold: ${alerts.viewsThreshold.toLocaleString()}`,
						``,
						`Sent by EmDash Statistics`,
					].join("\n"),
					html: `<h2>Traffic Alert</h2><p>Today's page views: <strong>${todayStats.views.toLocaleString()}</strong> (threshold: ${alerts.viewsThreshold.toLocaleString()})</p><p>Site: ${ctx.site.url}</p>`,
				})
				.catch(() => {}),
		);
	}

	if (alerts.bounceEnabled && alerts.bounceRecipient) {
		const sessions = sessionsResult.items.map(
			(item: { id: string; data: unknown }) => item.data as Session,
		);
		const completed = sessions.filter((s) => s.lastSeen > s.startTime);
		const bounced = completed.filter((s) => s.pageViews <= 1).length;
		const bounceRate = completed.length > 0 ? Math.round((bounced / completed.length) * 100) : 0;
		if (bounceRate >= alerts.bounceThreshold) {
			promises.push(
				ctx.email
					.send({
						to: alerts.bounceRecipient,
						subject: `[Alert] Bounce rate ${bounceRate}% — threshold exceeded`,
						text: [
							`Bounce Rate Alert — ${ctx.site.url}`,
							``,
							`Current bounce rate (30-day): ${bounceRate}%`,
							`Alert threshold: ${alerts.bounceThreshold}%`,
							``,
							`Sent by EmDash Statistics`,
						].join("\n"),
						html: `<h2>Bounce Rate Alert</h2><p>Current bounce rate (30-day): <strong>${bounceRate}%</strong> (threshold: ${alerts.bounceThreshold}%)</p><p>Site: ${ctx.site.url}</p>`,
					})
					.catch(() => {}),
			);
		}
	}

	if (alerts.newRecordEnabled && alerts.newRecordRecipient) {
		const allTimeRecord = (await ctx.kv.get<number>("state:allTimeViewsRecord")) ?? 0;
		if (todayStats.views > allTimeRecord && todayStats.views > 0) {
			await ctx.kv.set("state:allTimeViewsRecord", todayStats.views);
			promises.push(
				ctx.email
					.send({
						to: alerts.newRecordRecipient,
						subject: `[Record] New all-time daily views record: ${todayStats.views.toLocaleString()}`,
						text: [
							`New Record! — ${ctx.site.url}`,
							``,
							`Today's page views: ${todayStats.views.toLocaleString()}`,
							`Previous record: ${allTimeRecord.toLocaleString()}`,
							``,
							`Sent by EmDash Statistics`,
						].join("\n"),
						html: `<h2>New Record!</h2><p>Today's page views: <strong>${todayStats.views.toLocaleString()}</strong> (previous: ${allTimeRecord.toLocaleString()})</p><p>Site: ${ctx.site.url}</p>`,
					})
					.catch(() => {}),
			);
		}
	}

	await Promise.all(promises);
}

// ── CSV / Email Helpers ───────────────────────────────────────────────────────

function generateCsv(
	rows: { label: string; views: number; sessions: number; newVisitors: number }[],
	locale = "en",
): string {
	const header =
		locale === "ar"
			? "الفترة,مشاهدات الصفحة,الجلسات,الزوار الجدد\n"
			: "Period,Page Views,Sessions,New Visitors\n";
	const body = rows.map((r) => `"${r.label}",${r.views},${r.sessions},${r.newVisitors}`).join("\n");
	return header + body;
}

function buildReportEmailHtml(
	periodLabel: string,
	rows: { label: string; views: number; sessions: number; newVisitors: number }[],
	siteUrl: string,
): string {
	const totalViews = rows.reduce((acc, r) => acc + r.views, 0);
	const totalSessions = rows.reduce((acc, r) => acc + r.sessions, 0);
	const recent = rows.slice(-10);
	const tableRows = recent
		.map(
			(r) =>
				`<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${r.label}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.views.toLocaleString()}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.sessions.toLocaleString()}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.newVisitors.toLocaleString()}</td></tr>`,
		)
		.join("");
	return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;color:#333">
<h2 style="color:#1a1a2e">Analytics Report — ${periodLabel}</h2>
<p style="color:#666">Site: <a href="${siteUrl}">${siteUrl}</a></p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="background:#f5f5f5"><td style="padding:12px 10px;font-weight:bold">Total Views</td><td style="padding:12px 10px;text-align:right;font-size:1.4em;font-weight:bold">${totalViews.toLocaleString()}</td><td style="padding:12px 10px;font-weight:bold">Total Sessions</td><td style="padding:12px 10px;text-align:right;font-size:1.4em;font-weight:bold">${totalSessions.toLocaleString()}</td></tr>
</table>
<h3 style="color:#1a1a2e">Breakdown</h3>
<table style="width:100%;border-collapse:collapse">
<thead><tr style="background:#1a1a2e;color:#fff"><th style="padding:8px 10px;text-align:left">Period</th><th style="padding:8px 10px;text-align:right">Views</th><th style="padding:8px 10px;text-align:right">Sessions</th><th style="padding:8px 10px;text-align:right">New Visitors</th></tr></thead>
<tbody>${tableRows}</tbody>
</table>
<p style="color:#999;font-size:12px;margin-top:24px">Sent by EmDash Statistics plugin</p>
</body></html>`;
}

async function sendAnalyticsEmail(
	ctx: PluginContext,
	periodLabel: string,
	rows: { label: string; views: number; sessions: number; newVisitors: number }[],
	recipient: string,
): Promise<void> {
	if (!ctx.email) throw new Error("Email provider not configured");
	const locale = getStatisticsLocale(ctx);
	const totalViews = rows.reduce((acc, r) => acc + r.views, 0);
	const text = [
		`Analytics Report — ${periodLabel}`,
		`Site: ${ctx.site.url}`,
		``,
		`Total Views: ${totalViews.toLocaleString()}`,
		`Total Sessions: ${rows.reduce((acc, r) => acc + r.sessions, 0).toLocaleString()}`,
		``,
		`Breakdown (recent periods):`,
		...rows
			.slice(-10)
			.map((r) => `  ${r.label}: ${r.views} views, ${r.sessions} sessions, ${r.newVisitors} new`),
		``,
		`Sent by EmDash Statistics`,
	].join("\n");
	const localizedText = translateStatisticsText(locale, text);
	const localizedHtml = translateStatisticsText(
		locale,
		buildReportEmailHtml(periodLabel, rows, ctx.site.url),
	);
	await ctx.email.send({
		to: recipient,
		subject: `Analytics Report: ${totalViews.toLocaleString()} views — ${periodLabel}`,
		text: localizedText,
		html: localizedHtml,
	});
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
	if (sec < 60) return `${sec}s`;
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function trendOf(a: number, b: number): "up" | "down" | "neutral" | undefined {
	if (b === 0) return undefined;
	return a > b ? "up" : a < b ? "down" : "neutral";
}

function pct(part: number, total: number): string {
	if (total === 0) return "0%";
	return `${Math.round((part / total) * 100)}%`;
}

function formatDeviceLabel(brand: string | undefined, model: string | undefined): string {
	const cleanBrand = brand?.trim() ?? "";
	const cleanModel = model?.trim() ?? "";
	if (cleanBrand && cleanModel) {
		return cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())
			? cleanModel
			: `${cleanBrand} ${cleanModel}`;
	}
	return cleanModel || cleanBrand;
}

function countryFlag(code: string): string {
	if (!code || code.length !== 2) return "";
	const cp = Array.from(code.toUpperCase(), (c) => 0x1f1e0 + c.charCodeAt(0) - 65);
	return String.fromCodePoint(...cp);
}

function sortItems<T>(items: Iterable<T>, compare: (a: T, b: T) => number): T[] {
	const sorted = [...items];
	// oxlint-disable-next-line unicorn/no-array-sort, e18e(prefer-array-to-sorted)
	sorted.sort(compare);
	return sorted;
}

function topN<K extends string>(
	map: Map<K, number>,
	n: number,
	total: number,
): { key: K; count: number; share: string }[] {
	return sortItems(map.entries(), (a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([key, count]) => ({ key, count, share: pct(count, total) }));
}

// ── Data Loader ───────────────────────────────────────────────────────────────

async function loadAnalyticsData(ctx: PluginContext): Promise<AnalyticsData> {
	const thirtyDaysAgo = getDateKey(29);

	const [todayStats, yesterdayStats, liveVisitors, last30Raw, sessionsResult] = await Promise.all([
		getDailyStats(ctx, getDateKey(0)),
		getDailyStats(ctx, getDateKey(1)),
		getActiveLiveVisitors(ctx),
		Promise.all(getLast30Days().map(async (date) => ({ date, s: await getDailyStats(ctx, date) }))),
		ctx.storage.sessions!.query({
			where: { date: { gte: thirtyDaysAgo } },
			orderBy: { date: "desc" },
			limit: 2000,
		}),
	]);

	const totalViews30 = last30Raw.reduce((n, d) => n + d.s.views, 0);
	const totalSessions30 = last30Raw.reduce((n, d) => n + d.s.uniqueSessions, 0);
	const totalNew30 = last30Raw.reduce((n, d) => n + d.s.newVisitors, 0);
	const totalReturning30 = Math.max(0, totalSessions30 - totalNew30);

	const totalSources = last30Raw.reduce((acc, { s }) => {
		const src = s.sources ?? emptySourceCounts();
		return {
			direct: acc.direct + src.direct,
			search: acc.search + src.search,
			social: acc.social + src.social,
			referral: acc.referral + src.referral,
			paid: acc.paid + src.paid,
		};
	}, emptySourceCounts());

	const sessions = sessionsResult.items.map(
		(item: { id: string; data: unknown }) => item.data as Session,
	);
	const completedSessions = sessions.filter((s) => s.lastSeen > s.startTime);
	const bouncedCount = completedSessions.filter((s) => s.pageViews <= 1).length;
	const bounceRate =
		completedSessions.length > 0 ? Math.round((bouncedCount / completedSessions.length) * 100) : 0;
	const avgDurationSec =
		completedSessions.length > 0
			? Math.round(
					completedSessions.reduce((sum, s) => sum + (s.lastSeen - s.startTime) / 1000, 0) /
						completedSessions.length,
				)
			: 0;

	return {
		liveCount: liveVisitors.length,
		liveVisitors,
		todayStats,
		yesterdayStats,
		totalViews30,
		totalSessions30,
		totalNew30,
		totalReturning30,
		totalSources,
		sessions,
		completedSessions,
		bounceRate,
		avgDurationSec,
	};
}

// ── Dark Mode ─────────────────────────────────────────────────────────────────

function applyDarkMode(blocks: unknown[], dark: boolean): unknown[] {
	if (!dark) return blocks;
	return blocks.map((b) => {
		if (!isRecord(b)) return b;
		if (b.type === "chart" && isRecord(b.config) && isRecord(b.config.options)) {
			const existingOptions = b.config.options as Record<string, unknown>;
			const existingLegend = isRecord(existingOptions.legend)
				? { ...(existingOptions.legend as Record<string, unknown>), textStyle: { color: "#ccc" } }
				: existingOptions.legend;
			return {
				...b,
				config: {
					...b.config,
					options: {
						...existingOptions,
						backgroundColor: "#1a1a2e",
						textStyle: { color: "#ccc" },
						legend: existingLegend,
					},
				},
			};
		}
		if (b.type === "columns" && Array.isArray(b.columns)) {
			return {
				...b,
				columns: (b.columns as unknown[]).map((col) =>
					Array.isArray(col) ? applyDarkMode(col, dark) : col,
				),
			};
		}
		return b;
	});
}

async function getPluginAppearance(
	ctx: PluginContext,
): Promise<{ themeMode: "light" | "dark" } | undefined> {
	const dashSettings = await getDashboardSettings(ctx);
	return dashSettings.darkMode ? { themeMode: "dark" } : undefined;
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────

async function buildSettingsTab(ctx: PluginContext): Promise<unknown[]> {
	const [dashSettings, alertSettings, advancedSettings, userListResult] = await Promise.all([
		getDashboardSettings(ctx),
		getAlertSettings(ctx),
		getAdvancedSettings(ctx),
		ctx.users?.list({ limit: 20 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
	]);

	const roleOptions = [
		{ value: "10", label: "Subscriber (10)" },
		{ value: "20", label: "Contributor (20)" },
		{ value: "30", label: "Author (30)" },
		{ value: "40", label: "Editor (40)" },
		{ value: "50", label: "Admin only (50)" },
	];

	const blocks: unknown[] = [
		{ type: "context", text: "Dashboard & Multi-Site Settings" },
		{
			type: "form",
			fields: [
				{
					type: "toggle",
					action_id: "darkMode",
					label: "Dark Mode Dashboard",
					description: "Apply dark theme to all charts and graphs",
					initial_value: dashSettings.darkMode,
				},
				{
					type: "text_input",
					action_id: "multiSiteLabel",
					label: "Site Label",
					placeholder: "My Site",
					description:
						"Label shown in reports and email alerts — useful when running multiple EmDash instances",
					initial_value: dashSettings.multiSiteLabel,
				},
				{
					type: "select",
					action_id: "defaultReportPeriod",
					label: "Default Report Period",
					options: [
						{ value: "daily", label: "Daily (last 30 days)" },
						{ value: "weekly", label: "Weekly (last 12 weeks)" },
						{ value: "monthly", label: "Monthly (last 12 months)" },
					],
					initial_value: dashSettings.defaultReportPeriod,
				},
			],
			submit: { label: "Save Dashboard Settings", action_id: "save_dashboard_settings" },
		},
		{ type: "divider" },
		{ type: "context", text: "Role-Based Access Control" },
		{
			type: "form",
			fields: [
				{
					type: "select",
					action_id: "minViewRole",
					label: "Minimum Role to View Analytics",
					description:
						"Users must have at least this role to access the analytics dashboard. Role levels: Subscriber=10, Contributor=20, Author=30, Editor=40, Admin=50.",
					options: roleOptions,
					initial_value: String(dashSettings.minViewRole),
				},
			],
			submit: { label: "Save Access Settings", action_id: "save_access_settings" },
		},
	];

	if (userListResult.items.length > 0) {
		const usersWithAccess = userListResult.items.filter(
			(u: { role: number }) => u.role >= dashSettings.minViewRole,
		);
		blocks.push({
			type: "stats",
			items: [
				{ label: "Total Users", value: String(userListResult.items.length) },
				{ label: "Have Access", value: String(usersWithAccess.length) },
				{
					label: "Min Role",
					value:
						roleOptions.find((r) => r.value === String(dashSettings.minViewRole))?.label ??
						String(dashSettings.minViewRole),
				},
			],
		});
		blocks.push({
			type: "table",
			columns: [
				{ key: "name", label: "User", format: "text" },
				{ key: "email", label: "Email", format: "text" },
				{ key: "role", label: "Role", format: "text" },
				{ key: "access", label: "Access", format: "text" },
			],
			rows: userListResult.items.map((u: { name: string | null; email: string; role: number }) => ({
				name: u.name ?? "(no name)",
				email: u.email,
				role: roleOptions.find((r) => r.value === String(u.role))?.label ?? String(u.role),
				access: u.role >= dashSettings.minViewRole ? "Allowed" : "Restricted",
			})),
			page_action_id: "noop",
			empty_text: "No users found",
		});
	}

	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Notification Alerts" });
	blocks.push({
		type: "form",
		fields: [
			{
				type: "toggle",
				action_id: "alertViewsEnabled",
				label: "Daily Views Alert",
				description: "Send an email when daily page views exceed the threshold",
				initial_value: alertSettings.viewsEnabled,
			},
			{
				type: "text_input",
				action_id: "alertViewsThreshold",
				label: "Views Alert Threshold",
				placeholder: "1000",
				description: "Notify when daily views reach this number",
				initial_value: String(alertSettings.viewsThreshold),
			},
			{
				type: "text_input",
				action_id: "alertViewsRecipient",
				label: "Views Alert Email",
				placeholder: "admin@example.com",
				initial_value: alertSettings.viewsRecipient,
			},
			{
				type: "toggle",
				action_id: "alertBounceEnabled",
				label: "Bounce Rate Alert",
				description: "Send an email when 30-day bounce rate exceeds the threshold",
				initial_value: alertSettings.bounceEnabled,
			},
			{
				type: "text_input",
				action_id: "alertBounceThreshold",
				label: "Bounce Rate Threshold (%)",
				placeholder: "70",
				description: "Alert when bounce rate reaches this percentage",
				initial_value: String(alertSettings.bounceThreshold),
			},
			{
				type: "text_input",
				action_id: "alertBounceRecipient",
				label: "Bounce Alert Email",
				placeholder: "admin@example.com",
				initial_value: alertSettings.bounceRecipient,
			},
			{
				type: "toggle",
				action_id: "alertNewRecordEnabled",
				label: "New Daily Record Alert",
				description: "Send an email when today sets a new all-time daily views record",
				initial_value: alertSettings.newRecordEnabled,
			},
			{
				type: "text_input",
				action_id: "alertNewRecordRecipient",
				label: "New Record Email",
				placeholder: "admin@example.com",
				initial_value: alertSettings.newRecordRecipient,
			},
		],
		submit: { label: "Save Alert Settings", action_id: "save_alert_settings" },
	});
	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Advanced Analytics Features" });
	blocks.push({
		type: "form",
		fields: [
			{
				type: "toggle",
				action_id: "heatmapTrackingEnabled",
				label: "Heatmap Tracking",
				description: "Aggregate click zones per page across the last 30 days",
				initial_value: advancedSettings.heatmapTrackingEnabled,
			},
			{
				type: "toggle",
				action_id: "scrollTrackingEnabled",
				label: "Scroll Tracking",
				description: "Store max scroll depth and page-level scroll distribution",
				initial_value: advancedSettings.scrollTrackingEnabled,
			},
			{
				type: "toggle",
				action_id: "sessionRecordingEnabled",
				label: "Session Recording",
				description: "Capture a privacy-safe event timeline of clicks, scrolls, and navigation",
				initial_value: advancedSettings.sessionRecordingEnabled,
			},
			{
				type: "toggle",
				action_id: "funnelAnalyticsEnabled",
				label: "Funnel Analytics",
				description: "Measure step-by-step conversion using ordered page paths",
				initial_value: advancedSettings.funnelAnalyticsEnabled,
			},
			{
				type: "text_input",
				action_id: "funnelSteps",
				label: "Funnel Steps",
				placeholder: "/,/pricing,/signup,/checkout,/thank-you",
				description: "Comma-separated paths in order of the desired funnel",
				initial_value: advancedSettings.funnelSteps.join(", "),
			},
			{
				type: "toggle",
				action_id: "abTestingEnabled",
				label: "A/B Testing",
				description: "Assign stable variants and measure conversions by goal path",
				initial_value: advancedSettings.abTestingEnabled,
			},
			{
				type: "text_input",
				action_id: "abExperiments",
				label: "Experiment Rules",
				placeholder: "pricing_test@/pricing->/signup:control,variant",
				description:
					"Separate multiple rules with ; using experiment@pathPrefix->goalPath:variantA,variantB",
				initial_value: advancedSettings.abExperiments,
			},
			{
				type: "toggle",
				action_id: "cohortAnalysisEnabled",
				label: "Cohort Analysis",
				description: "Track weekly retention for newly acquired visitors",
				initial_value: advancedSettings.cohortAnalysisEnabled,
			},
		],
		submit: { label: "Save Advanced Settings", action_id: "save_advanced_settings" },
	});

	return blocks;
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────

function tabBar(active: Tab): unknown {
	const tabs: { id: Tab; label: string }[] = [
		{ id: "overview", label: "Overview" },
		{ id: "live", label: "Real-Time" },
		{ id: "traffic", label: "Traffic Sources" },
		{ id: "insights", label: "Visitor Insights" },
		{ id: "advanced", label: "Advanced" },
		{ id: "sessions", label: "Sessions" },
		{ id: "devices", label: "Devices" },
		{ id: "content", label: "Content" },
		{ id: "seo", label: "SEO / Search" },
		{ id: "reports", label: "Reports & Charts" },
		{ id: "settings", label: "Settings" },
	];
	return {
		type: "actions",
		elements: tabs.map((t) => ({
			type: "button",
			action_id: `tab:${t.id}`,
			label: t.label,
			style: t.id === active ? "primary" : "secondary",
		})),
	};
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function buildOverviewTab(
	data: AnalyticsData,
	last30Raw: { date: string; s: DailyStats }[],
): unknown[] {
	const {
		liveCount,
		todayStats,
		yesterdayStats,
		totalViews30,
		totalSessions30,
		totalNew30,
		totalReturning30,
		bounceRate,
		avgDurationSec,
		completedSessions,
	} = data;

	const viewsTrend = trendOf(todayStats.views, yesterdayStats.views);
	const sessionsTrend = trendOf(todayStats.uniqueSessions, yesterdayStats.uniqueSessions);
	const multiPageCount = completedSessions.filter((s) => s.pageViews >= 2).length;
	const multiPageRate =
		completedSessions.length > 0
			? Math.round((multiPageCount / completedSessions.length) * 100)
			: 0;
	const avgPages =
		completedSessions.length > 0
			? (
					completedSessions.reduce((sum, s) => sum + s.pageViews, 0) / completedSessions.length
				).toFixed(1)
			: "0";

	const viewsChartData: [number, number][] = last30Raw.map(({ date, s }) => [
		new Date(date + "T00:00:00Z").getTime(),
		s.views,
	]);
	const sessionsChartData: [number, number][] = last30Raw.map(({ date, s }) => [
		new Date(date + "T00:00:00Z").getTime(),
		s.uniqueSessions,
	]);

	return [
		{
			type: "stats",
			items: [
				{ label: "Live Visitors", value: String(liveCount), description: "Active in last 5 min" },
				{
					label: "Views Today",
					value: String(todayStats.views),
					...(viewsTrend ? { trend: viewsTrend } : {}),
				},
				{
					label: "Sessions Today",
					value: String(todayStats.uniqueSessions),
					...(sessionsTrend ? { trend: sessionsTrend } : {}),
				},
				{ label: "New Today", value: String(todayStats.newVisitors) },
			],
		},
		{ type: "divider" },
		{ type: "context", text: "30-day summary" },
		{
			type: "stats",
			items: [
				{ label: "Total Page Views", value: totalViews30.toLocaleString() },
				{ label: "Total Sessions", value: totalSessions30.toLocaleString() },
				{ label: "New Visitors", value: totalNew30.toLocaleString() },
				{ label: "Returning Visitors", value: totalReturning30.toLocaleString() },
			],
		},
		{
			type: "columns",
			columns: [
				[
					{
						type: "meter",
						label: "Bounce Rate",
						value: bounceRate,
						max: 100,
						custom_value: `${bounceRate}% of sessions were single-page`,
					},
				],
				[
					{
						type: "meter",
						label: "Multi-page Rate",
						value: multiPageRate,
						max: 100,
						custom_value: `${multiPageRate}% of sessions viewed 2+ pages`,
					},
				],
				[
					{
						type: "stats",
						items: [
							{
								label: "Avg. Duration",
								value: formatDuration(avgDurationSec),
								description: "Per session",
							},
							{ label: "Avg. Pages", value: avgPages, description: "Per session" },
						],
					},
				],
			],
		},
		{ type: "divider" },
		{ type: "context", text: "Daily trend — last 30 days" },
		{
			type: "chart",
			config: {
				chart_type: "timeseries",
				style: "bar",
				gradient: true,
				series: [
					{ name: "Page Views", data: viewsChartData },
					{ name: "Sessions", data: sessionsChartData },
				],
				x_axis_name: "Date",
				y_axis_name: "Count",
				height: 320,
			},
		},
		{ type: "divider" },
		{ type: "context", text: "New vs Returning — 30 days" },
		{
			type: "chart",
			config: {
				chart_type: "custom",
				height: 300,
				options: {
					tooltip: { trigger: "item" },
					legend: { bottom: 0, left: "center" },
					series: [
						{
							type: "pie",
							radius: ["45%", "70%"],
							center: ["50%", "48%"],
							data: [
								{ value: totalNew30, name: "New Visitors" },
								{ value: totalReturning30, name: "Returning Visitors" },
							],
						},
					],
				},
			},
		},
	];
}

function buildLiveTab(data: AnalyticsData, siteOrigin: string): unknown[] {
	const activeVisitors = data.liveVisitors;
	const pageCounts = new Map<string, number>();
	const referrerCounts = new Map<string, number>();
	const countryCounts = new Map<string, number>();
	const cityCounts = new Map<string, number>();

	for (const visitor of activeVisitors) {
		const page = visitor.pageUrl || "(unknown)";
		pageCounts.set(page, (pageCounts.get(page) ?? 0) + 1);

		const referrer = referrerDomain(visitor.referrer, siteOrigin);
		referrerCounts.set(referrer, (referrerCounts.get(referrer) ?? 0) + 1);

		if (visitor.country) {
			countryCounts.set(visitor.country, (countryCounts.get(visitor.country) ?? 0) + 1);
		}

		const locationKey = formatLocation(visitor.city, visitor.region, visitor.country);
		cityCounts.set(locationKey, (cityCounts.get(locationKey) ?? 0) + 1);
	}

	const activePages = topN(pageCounts, 10, Math.max(activeVisitors.length, 1)).map(
		({ key, count, share }) => ({
			page: key,
			visitors: count,
			share,
		}),
	);
	const currentReferrers = topN(referrerCounts, 10, Math.max(activeVisitors.length, 1)).map(
		({ key, count, share }) => ({
			referrer: key,
			visitors: count,
			share,
		}),
	);
	const liveCountries = topN(countryCounts, 8, Math.max(activeVisitors.length, 1));
	const liveCities = topN(cityCounts, 10, Math.max(activeVisitors.length, 1)).map(
		({ key, count, share }) => ({
			location: key,
			visitors: count,
			share,
		}),
	);
	const recentVisitors = sortItems(data.sessions, (a, b) => b.lastSeen - a.lastSeen).slice(0, 10);

	const blocks: unknown[] = [
		{
			type: "stats",
			items: [
				{
					label: "Online Users Now",
					value: String(activeVisitors.length),
					description: "Last 5 min",
				},
				{ label: "Current Active Pages", value: String(pageCounts.size) },
				{ label: "Current Referrers", value: String(referrerCounts.size) },
				{ label: "Live Countries", value: String(countryCounts.size) },
			],
		},
	];

	if (activeVisitors.length === 0) {
		blocks.push({ type: "divider" });
		blocks.push({
			type: "banner",
			title: "No live visitors right now",
			description:
				"Open your site in another tab or wait for fresh traffic. Real-time sections update from view and ping events within the last 5 minutes.",
			variant: "default",
		});
	}

	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Current active pages" });
	blocks.push({
		type: "table",
		columns: [
			{ key: "page", label: "Page", format: "link" },
			{ key: "visitors", label: "Active Users", format: "number" },
			{ key: "share", label: "Share", format: "text" },
		],
		rows: activePages,
		page_action_id: "noop",
		empty_text: "No active pages right now",
	});

	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Current referrers" });
	blocks.push({
		type: "table",
		columns: [
			{ key: "referrer", label: "Referrer", format: "text" },
			{ key: "visitors", label: "Active Users", format: "number" },
			{ key: "share", label: "Share", format: "text" },
		],
		rows: currentReferrers,
		page_action_id: "noop",
		empty_text: "No active referrers right now",
	});

	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Recent visitors feed" });
	blocks.push({
		type: "table",
		columns: [
			{ key: "time", label: "Last Seen", format: "relative_time" },
			{ key: "page", label: "Page", format: "link" },
			{ key: "source", label: "Source", format: "text" },
			{ key: "location", label: "Location", format: "text" },
		],
		rows: recentVisitors.map((session) => ({
			time: new Date(session.lastSeen).toISOString(),
			page: session.exitPage || session.entryPage || "(unknown)",
			source: referrerDomain(session.referrer, siteOrigin),
			location: formatLocation(session.city, session.region, session.country),
		})),
		page_action_id: "noop",
		empty_text: "No recent visitors yet",
	});

	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Live traffic map" });
	if (liveCountries.length > 0) {
		const countryMax = Math.max(liveCountries[0]?.count ?? 1, 1);
		blocks.push({
			type: "columns",
			columns: [
				liveCountries.map(({ key, count, share }) => ({
					type: "meter",
					label: `${countryFlag(key)} ${key}`,
					value: count,
					max: countryMax,
					custom_value: `${count} live users (${share})`,
				})),
				[
					{
						type: "table",
						columns: [
							{ key: "location", label: "Location", format: "text" },
							{ key: "visitors", label: "Users", format: "number" },
							{ key: "share", label: "Share", format: "text" },
						],
						rows: liveCities,
						page_action_id: "noop",
						empty_text: "No live geo data",
					},
				],
			],
		});
	} else {
		blocks.push({
			type: "banner",
			title: "Geo data unavailable",
			description:
				"Live traffic map needs country/city metadata from the request. In local dev this usually stays empty unless your runtime provides geo headers.",
			variant: "default",
		});
	}

	return blocks;
}

// ── Tab: Traffic Sources ──────────────────────────────────────────────────────

function buildTrafficTab(data: AnalyticsData, siteOrigin: string): unknown[] {
	const { totalSources, todayStats } = data;

	const totalSourceSessions =
		totalSources.direct +
		totalSources.search +
		totalSources.social +
		totalSources.referral +
		totalSources.paid;

	const todaySources = todayStats.sources ?? emptySourceCounts();
	const todayTotal = todayStats.uniqueSessions || 1;

	const referrerCounts = new Map<string, number>();
	const utmCampaignCounts = new Map<string, number>();
	const utmMediumCounts = new Map<string, number>();
	const utmSourceCounts = new Map<string, number>();

	for (const s of data.sessions) {
		if (s.source === "referral" && s.referrer) {
			const host = referrerDomain(s.referrer, siteOrigin);
			if (host !== "Direct") {
				referrerCounts.set(host, (referrerCounts.get(host) ?? 0) + 1);
			}
		}
		if (s.utmCampaign)
			utmCampaignCounts.set(s.utmCampaign, (utmCampaignCounts.get(s.utmCampaign) ?? 0) + 1);
		if (s.utmMedium) utmMediumCounts.set(s.utmMedium, (utmMediumCounts.get(s.utmMedium) ?? 0) + 1);
		if (s.utmSource) utmSourceCounts.set(s.utmSource, (utmSourceCounts.get(s.utmSource) ?? 0) + 1);
	}

	const topReferrers = sortItems(referrerCounts.entries(), (a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([domain, count]) => ({ domain, count, pct: pct(count, data.sessions.length) }));

	const topCampaigns = sortItems(utmCampaignCounts.entries(), (a, b) => b[1] - a[1]).slice(0, 10);
	const topMediums = sortItems(utmMediumCounts.entries(), (a, b) => b[1] - a[1]).slice(0, 6);
	const topUtmSources = sortItems(utmSourceCounts.entries(), (a, b) => b[1] - a[1]).slice(0, 6);

	const sourceMax = Math.max(totalSourceSessions, 1);

	const blocks: unknown[] = [
		{ type: "context", text: "30-day traffic breakdown" },
		{
			type: "stats",
			items: [
				{
					label: "Direct",
					value: totalSources.direct.toLocaleString(),
					description: pct(totalSources.direct, totalSourceSessions),
				},
				{
					label: "Search Engine",
					value: totalSources.search.toLocaleString(),
					description: pct(totalSources.search, totalSourceSessions),
				},
				{
					label: "Social Media",
					value: totalSources.social.toLocaleString(),
					description: pct(totalSources.social, totalSourceSessions),
				},
				{
					label: "Referral",
					value: totalSources.referral.toLocaleString(),
					description: pct(totalSources.referral, totalSourceSessions),
				},
				{
					label: "Paid",
					value: totalSources.paid.toLocaleString(),
					description: pct(totalSources.paid, totalSourceSessions),
				},
			],
		},
		{
			type: "chart",
			config: {
				chart_type: "custom",
				height: 320,
				options: {
					tooltip: { trigger: "item" },
					legend: { bottom: 0, left: "center" },
					series: [
						{
							type: "pie",
							radius: ["42%", "68%"],
							center: ["50%", "48%"],
							data: [
								{ value: totalSources.direct, name: "Direct" },
								{ value: totalSources.search, name: "Search" },
								{ value: totalSources.social, name: "Social" },
								{ value: totalSources.referral, name: "Referral" },
								{ value: totalSources.paid, name: "Paid" },
							].filter((d) => d.value > 0),
						},
					],
				},
			},
		},
		{ type: "divider" },
		{ type: "context", text: "30-day source meters" },
		{
			type: "columns",
			columns: [
				[
					{
						type: "meter",
						label: "Direct",
						value: totalSources.direct,
						max: sourceMax,
						custom_value: `${totalSources.direct.toLocaleString()} (${pct(totalSources.direct, totalSourceSessions)})`,
					},
					{
						type: "meter",
						label: "Search Engine",
						value: totalSources.search,
						max: sourceMax,
						custom_value: `${totalSources.search.toLocaleString()} (${pct(totalSources.search, totalSourceSessions)})`,
					},
					{
						type: "meter",
						label: "Social Media",
						value: totalSources.social,
						max: sourceMax,
						custom_value: `${totalSources.social.toLocaleString()} (${pct(totalSources.social, totalSourceSessions)})`,
					},
				],
				[
					{
						type: "meter",
						label: "Referral",
						value: totalSources.referral,
						max: sourceMax,
						custom_value: `${totalSources.referral.toLocaleString()} (${pct(totalSources.referral, totalSourceSessions)})`,
					},
					{
						type: "meter",
						label: "Paid",
						value: totalSources.paid,
						max: sourceMax,
						custom_value: `${totalSources.paid.toLocaleString()} (${pct(totalSources.paid, totalSourceSessions)})`,
					},
				],
			],
		},
		{ type: "divider" },
		{ type: "context", text: "Today's traffic breakdown" },
		{
			type: "columns",
			columns: [
				[
					{
						type: "meter",
						label: "Direct",
						value: todaySources.direct,
						max: todayTotal,
						custom_value: `${todaySources.direct} (${pct(todaySources.direct, todayTotal)})`,
					},
					{
						type: "meter",
						label: "Search",
						value: todaySources.search,
						max: todayTotal,
						custom_value: `${todaySources.search} (${pct(todaySources.search, todayTotal)})`,
					},
					{
						type: "meter",
						label: "Social",
						value: todaySources.social,
						max: todayTotal,
						custom_value: `${todaySources.social} (${pct(todaySources.social, todayTotal)})`,
					},
				],
				[
					{
						type: "meter",
						label: "Referral",
						value: todaySources.referral,
						max: todayTotal,
						custom_value: `${todaySources.referral} (${pct(todaySources.referral, todayTotal)})`,
					},
					{
						type: "meter",
						label: "Paid",
						value: todaySources.paid,
						max: todayTotal,
						custom_value: `${todaySources.paid} (${pct(todaySources.paid, todayTotal)})`,
					},
				],
			],
		},
	];

	if (topReferrers.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Top referral websites — 30 days" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "domain", label: "Domain", format: "text" },
				{ key: "count", label: "Sessions", format: "number" },
				{ key: "pct", label: "Share", format: "text" },
			],
			rows: topReferrers,
			page_action_id: "noop",
			empty_text: "No referrals yet",
		});
	}

	if (topCampaigns.length > 0 || topMediums.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Campaign tracking (UTM) — 30 days" });

		if (topUtmSources.length > 0) {
			blocks.push({
				type: "fields",
				fields: topUtmSources.map(([src, count]) => ({
					label: `utm_source: ${src}`,
					value: `${count} sessions`,
				})),
			});
		}
		if (topMediums.length > 0) {
			blocks.push({
				type: "fields",
				fields: topMediums.map(([med, count]) => ({
					label: `utm_medium: ${med}`,
					value: `${count} — ${["cpc", "paid", "ppc", "display"].includes(med) ? "Paid" : "Organic"}`,
				})),
			});
		}
		if (topCampaigns.length > 0) {
			blocks.push({
				type: "table",
				columns: [
					{ key: "campaign", label: "Campaign", format: "text" },
					{ key: "sessions", label: "Sessions", format: "number" },
				],
				rows: topCampaigns.map(([campaign, s]) => ({ campaign, sessions: s })),
				page_action_id: "noop",
				empty_text: "No campaigns",
			});
		}
	}

	return blocks;
}

// ── Tab: Visitor Insights ─────────────────────────────────────────────────────

function buildInsightsTab(data: AnalyticsData): unknown[] {
	const { sessions } = data;

	const countryCounts = new Map<string, number>();
	const cityCounts = new Map<string, { count: number; country: string }>();
	const langCounts = new Map<string, number>();
	const tzCounts = new Map<string, number>();

	for (const s of sessions) {
		if (s.country) countryCounts.set(s.country, (countryCounts.get(s.country) ?? 0) + 1);
		if (s.city && s.country) {
			const key = `${s.city}||${s.country}`;
			cityCounts.set(key, { count: (cityCounts.get(key)?.count ?? 0) + 1, country: s.country });
		}
		if (s.language) langCounts.set(s.language, (langCounts.get(s.language) ?? 0) + 1);
		if (s.timezone) tzCounts.set(s.timezone, (tzCounts.get(s.timezone) ?? 0) + 1);
	}

	const topCountries = sortItems(countryCounts.entries(), (a, b) => b[1] - a[1])
		.slice(0, 15)
		.map(([code, count]) => ({
			country: `${countryFlag(code)} ${code}`,
			sessions: count,
			pct: pct(count, sessions.length),
		}));

	const topCities = sortItems(cityCounts.entries(), (a, b) => b[1].count - a[1].count)
		.slice(0, 10)
		.map(([key, { count, country }]) => ({
			city: key.split("||")[0] ?? key,
			country: `${countryFlag(country)} ${country}`,
			sessions: count,
		}));

	const topLanguages = sortItems(langCounts.entries(), (a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([language, count]) => ({
			language,
			sessions: count,
			pct: pct(count, sessions.length),
		}));

	const topTimezones = sortItems(tzCounts.entries(), (a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([timezone, count]) => ({
			timezone,
			sessions: count,
			pct: pct(count, sessions.length),
		}));

	const countryMax = Math.max(topCountries[0]?.sessions ?? 1, 1);
	const hasGeo = topCountries.length > 0;

	const blocks: unknown[] = [];

	if (!hasGeo) {
		blocks.push({
			type: "banner",
			title: "No geo data available",
			description:
				"Country and city detection requires Cloudflare Workers. Geo data is read from the Cloudflare CF request object and is not available in local dev.",
			variant: "default",
		});
	}

	if (hasGeo) {
		blocks.push({ type: "context", text: "Top countries — 30 days" });

		const meterCols: unknown[][] = [[], [], []];
		topCountries.slice(0, 6).forEach(({ country, sessions: s }, i) => {
			meterCols[i % 3]!.push({
				type: "meter",
				label: country,
				value: s,
				max: countryMax,
				custom_value: `${s} (${pct(s, sessions.length)})`,
			});
		});
		blocks.push({ type: "columns", columns: meterCols.filter((c) => c.length > 0) });

		blocks.push({
			type: "chart",
			config: {
				chart_type: "custom",
				height: 300,
				options: {
					tooltip: { trigger: "item" },
					legend: { type: "scroll", bottom: 0, left: "center" },
					series: [
						{
							type: "pie",
							radius: ["42%", "68%"],
							center: ["50%", "46%"],
							data: topCountries.slice(0, 8).map(({ country, sessions: s }) => ({
								value: s,
								name: country,
							})),
						},
					],
				},
			},
		});

		blocks.push({ type: "divider" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "country", label: "Country", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "pct", label: "Share", format: "text" },
			],
			rows: topCountries,
			page_action_id: "noop",
			empty_text: "No country data",
		});

		if (topCities.length > 0) {
			blocks.push({ type: "divider" });
			blocks.push({ type: "context", text: "Top cities — 30 days" });
			blocks.push({
				type: "table",
				columns: [
					{ key: "city", label: "City", format: "text" },
					{ key: "country", label: "Country", format: "text" },
					{ key: "sessions", label: "Sessions", format: "number" },
				],
				rows: topCities,
				page_action_id: "noop",
				empty_text: "No city data",
			});
		}
	}

	if (topLanguages.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Browser languages — 30 days" });
		const langMax = Math.max(topLanguages[0]?.sessions ?? 1, 1);
		const langCols: unknown[][] = [[], []];
		topLanguages.slice(0, 6).forEach(({ language, sessions: s }, i) => {
			langCols[i % 2]!.push({
				type: "meter",
				label: language,
				value: s,
				max: langMax,
				custom_value: `${s} (${pct(s, sessions.length)})`,
			});
		});
		blocks.push({ type: "columns", columns: langCols.filter((c) => c.length > 0) });

		blocks.push({
			type: "table",
			columns: [
				{ key: "language", label: "Language", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "pct", label: "Share", format: "text" },
			],
			rows: topLanguages,
			page_action_id: "noop",
			empty_text: "No language data",
		});
	}

	if (topTimezones.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Timezones — 30 days" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "timezone", label: "Timezone", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "pct", label: "Share", format: "text" },
			],
			rows: topTimezones,
			page_action_id: "noop",
			empty_text: "No timezone data",
		});
	}

	return blocks;
}

// ── Tab: Sessions ─────────────────────────────────────────────────────────────

async function buildAdvancedTab(ctx: PluginContext, data: AnalyticsData): Promise<unknown[]> {
	const settings = await getAdvancedSettings(ctx);
	const blocks: unknown[] = [
		{
			type: "context",
			text: "Advanced analytics capabilities extend the core dashboard with deeper behavior analysis.",
		},
	];

	if (
		!settings.heatmapTrackingEnabled &&
		!settings.scrollTrackingEnabled &&
		!settings.sessionRecordingEnabled &&
		!settings.funnelAnalyticsEnabled &&
		!settings.abTestingEnabled &&
		!settings.cohortAnalysisEnabled
	) {
		blocks.push({
			type: "banner",
			title: "All advanced features are disabled",
			description: "Enable them from the Settings tab to start collecting advanced analytics data.",
			variant: "default",
		});
		return blocks;
	}

	if (settings.heatmapTrackingEnabled) {
		const heatDays = await Promise.all(getLast30Days().map((date) => getHeatmapDay(ctx, date)));
		const pageMap = new Map<string, { clicks: number; zones: Map<string, number> }>();
		for (const day of heatDays) {
			for (const [page, summary] of Object.entries(day.pages)) {
				const current = pageMap.get(page) ?? { clicks: 0, zones: new Map<string, number>() };
				current.clicks += summary.clicks;
				for (const [zone, count] of Object.entries(summary.zones)) {
					current.zones.set(zone, (current.zones.get(zone) ?? 0) + count);
				}
				pageMap.set(page, current);
			}
		}
		const heatRows = sortItems(pageMap.entries(), (a, b) => b[1].clicks - a[1].clicks)
			.slice(0, 8)
			.map(([page, summary]) => {
				const topZone = sortItems(summary.zones.entries(), (a, b) => b[1] - a[1])[0];
				return {
					page,
					clicks: summary.clicks,
					topZone: topZone ? formatZoneLabel(topZone[0]) : "No clicks yet",
					zoneClicks: topZone?.[1] ?? 0,
				};
			});

		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Heatmap activity by page" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "page", label: "Page", format: "link" },
				{ key: "clicks", label: "Clicks", format: "number" },
				{ key: "topZone", label: "Hottest Zone", format: "text" },
				{ key: "zoneClicks", label: "Zone Clicks", format: "number" },
			],
			rows: heatRows,
			page_action_id: "noop",
			empty_text: "No heatmap clicks yet",
		});
	}

	if (settings.scrollTrackingEnabled) {
		const scrollDays = await Promise.all(getLast30Days().map((date) => getScrollDay(ctx, date)));
		const pageMap = new Map<
			string,
			{ views: number; totalDepth: number; maxDepth: number; deepViews: number }
		>();
		for (const day of scrollDays) {
			for (const [page, summary] of Object.entries(day.pages)) {
				const current = pageMap.get(page) ?? {
					views: 0,
					totalDepth: 0,
					maxDepth: 0,
					deepViews: 0,
				};
				current.views += summary.views;
				current.totalDepth += summary.totalDepth;
				current.maxDepth = Math.max(current.maxDepth, summary.maxDepth);
				current.deepViews += summary.buckets["75"] ?? 0;
				pageMap.set(page, current);
			}
		}
		const scrollRows = sortItems(pageMap.entries(), (a, b) => b[1].views - a[1].views)
			.slice(0, 8)
			.map(([page, summary]) => ({
				page,
				views: summary.views,
				avgDepth: `${clampPercent(summary.totalDepth / Math.max(summary.views, 1))}%`,
				maxDepth: `${clampPercent(summary.maxDepth)}%`,
				deepViews: summary.deepViews,
			}));

		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Scroll depth by page" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "page", label: "Page", format: "link" },
				{ key: "views", label: "Tracked Views", format: "number" },
				{ key: "avgDepth", label: "Avg. Depth", format: "text" },
				{ key: "maxDepth", label: "Max Depth", format: "text" },
				{ key: "deepViews", label: "75%+ Views", format: "number" },
			],
			rows: scrollRows,
			page_action_id: "noop",
			empty_text: "No scroll depth data yet",
		});
	}

	if (settings.sessionRecordingEnabled) {
		const recordings = sortItems(
			(await ctx.kv.list("recording:")).map(({ value }) => value).filter(isSessionRecording),
			(a, b) => b.updatedAt - a.updatedAt,
		);
		const recordingRows = recordings.slice(0, 8).map((recording) => ({
			session: recording.sessionId,
			page: recording.pages.at(-1) ?? "(unknown)",
			events: recording.events.length,
			duration: formatDuration((recording.updatedAt - recording.startedAt) / 1000),
			preview: summarizeRecordingEvent(
				recording.events.at(-1) ?? {
					type: "navigate",
					at: 0,
					page: recording.pages[0] ?? "/",
				},
			),
		}));

		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Recent session recordings" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "session", label: "Session", format: "text" },
				{ key: "page", label: "Latest Page", format: "link" },
				{ key: "events", label: "Events", format: "number" },
				{ key: "duration", label: "Duration", format: "text" },
				{ key: "preview", label: "Latest Event", format: "text" },
			],
			rows: recordingRows,
			page_action_id: "noop",
			empty_text: "No session recordings yet",
		});
	}

	if (settings.funnelAnalyticsEnabled && settings.funnelSteps.length > 1) {
		const funnelRows = settings.funnelSteps.map((step, index) => {
			const count = data.sessions.filter((session) =>
				settings.funnelSteps.slice(0, index + 1).every((path) => hasVisitedPath(session, path)),
			).length;
			const previous =
				index === 0
					? data.sessions.length
					: data.sessions.filter((session) =>
							settings.funnelSteps.slice(0, index).every((path) => hasVisitedPath(session, path)),
						).length;
			return {
				step,
				sessions: count,
				conversion: pct(count, Math.max(data.sessions.length, 1)),
				dropoff: index === 0 ? "0" : `${Math.max(previous - count, 0)}`,
			};
		});

		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Funnel conversion" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "step", label: "Step", format: "link" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "conversion", label: "Conversion", format: "text" },
				{ key: "dropoff", label: "Drop-off", format: "text" },
			],
			rows: funnelRows,
			page_action_id: "noop",
			empty_text: "No funnel data yet",
		});
	}

	if (settings.abTestingEnabled) {
		const experiments = parseExperimentConfigs(settings.abExperiments);
		const rows = experiments.flatMap((experiment) =>
			experiment.variants.map((variant) => {
				const sessions = data.sessions.filter(
					(session) => session.experiments?.[experiment.id] === variant,
				);
				const converted = sessions.filter((session) =>
					hasVisitedPath(session, experiment.goalPath),
				).length;
				return {
					experiment: experiment.id,
					variant,
					sessions: sessions.length,
					converted,
					conversion: pct(converted, Math.max(sessions.length, 1)),
				};
			}),
		);

		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "A/B experiments" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "experiment", label: "Experiment", format: "text" },
				{ key: "variant", label: "Variant", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "converted", label: "Conversions", format: "number" },
				{ key: "conversion", label: "Conversion Rate", format: "text" },
			],
			rows,
			page_action_id: "noop",
			empty_text: "No experiment data yet",
		});
	}

	if (settings.cohortAnalysisEnabled) {
		const visitorList = await ctx.kv.list("visitor:");
		const cohorts = new Map<string, Set<string>>();
		for (const entry of visitorList) {
			if (!isRecord(entry.value) || typeof entry.value.firstSeen !== "string") continue;
			const cohort = startOfIsoWeek(entry.value.firstSeen);
			if (!cohorts.has(cohort)) cohorts.set(cohort, new Set());
			cohorts.get(cohort)!.add(entry.key.replace("visitor:", ""));
		}
		const recentCohorts = sortItems(cohorts.entries(), (a, b) => b[0].localeCompare(a[0])).slice(
			0,
			4,
		);
		const rows = recentCohorts.map(([cohort, visitors]) => {
			const sessions = data.sessions.filter((session) => visitors.has(session.visitorId));
			const week0 = new Set(
				sessions
					.filter((session) => startOfIsoWeek(session.date) === cohort)
					.map((session) => session.visitorId),
			).size;
			const week1 = new Set(
				sessions
					.filter((session) => startOfIsoWeek(session.date) !== cohort)
					.map((session) => session.visitorId),
			).size;
			return {
				cohort,
				visitors: visitors.size,
				week0: `${week0}`,
				week1: pct(week1, Math.max(visitors.size, 1)),
			};
		});

		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Weekly cohort retention" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "cohort", label: "Cohort Week", format: "text" },
				{ key: "visitors", label: "Visitors", format: "number" },
				{ key: "week0", label: "Week 0 Active", format: "text" },
				{ key: "week1", label: "Week 1 Retention", format: "text" },
			],
			rows,
			page_action_id: "noop",
			empty_text: "No cohort data yet",
		});
	}

	return blocks;
}

function buildSessionsTab(data: AnalyticsData): unknown[] {
	const { completedSessions, bounceRate, avgDurationSec } = data;
	const total = completedSessions.length;
	const bounced = completedSessions.filter((s) => s.pageViews <= 1).length;
	const multiPage = completedSessions.filter((s) => s.pageViews >= 2).length;
	const multiPageRate = total > 0 ? Math.round((multiPage / total) * 100) : 0;
	const avgPages =
		total > 0
			? (completedSessions.reduce((sum, s) => sum + s.pageViews, 0) / total).toFixed(1)
			: "0";

	const buckets = [
		{ label: "< 10s", min: 0, max: 10, count: 0 },
		{ label: "10-30s", min: 10, max: 30, count: 0 },
		{ label: "30-60s", min: 30, max: 60, count: 0 },
		{ label: "1-3m", min: 60, max: 180, count: 0 },
		{ label: "3-10m", min: 180, max: 600, count: 0 },
		{ label: "> 10m", min: 600, max: Infinity, count: 0 },
	];
	for (const s of completedSessions) {
		const dur = (s.lastSeen - s.startTime) / 1000;
		const bucket = buckets.find((b) => dur >= b.min && dur < b.max);
		if (bucket) bucket.count++;
	}

	const newSessions = completedSessions.filter((s) => s.isNew).length;
	const returningSessions = Math.max(0, total - newSessions);
	const bucketMax = Math.max(...buckets.map((b) => b.count), 1);

	if (total === 0) {
		return [
			{
				type: "banner",
				title: "No session data yet",
				description:
					"Sessions are recorded as visitors browse your site. Data will appear here once traffic is tracked.",
				variant: "default",
			},
		];
	}

	return [
		{ type: "context", text: `Analyzing ${total.toLocaleString()} sessions from the last 30 days` },
		{
			type: "stats",
			items: [
				{ label: "Total Sessions", value: total.toLocaleString() },
				{
					label: "Bounced",
					value: bounced.toLocaleString(),
					description: `${bounceRate}% bounce rate`,
				},
				{
					label: "Multi-page",
					value: multiPage.toLocaleString(),
					description: `${multiPageRate}% explored`,
				},
				{ label: "Avg. Pages", value: avgPages, description: "Per session" },
				{ label: "Avg. Duration", value: formatDuration(avgDurationSec) },
			],
		},
		{ type: "divider" },
		{ type: "context", text: "Engagement metrics" },
		{
			type: "columns",
			columns: [
				[
					{
						type: "meter",
						label: "Bounce Rate",
						value: bounceRate,
						max: 100,
						custom_value: `${bounceRate}% (${bounced.toLocaleString()} sessions)`,
					},
				],
				[
					{
						type: "meter",
						label: "Multi-page Rate",
						value: multiPageRate,
						max: 100,
						custom_value: `${multiPageRate}% (${multiPage.toLocaleString()} sessions)`,
					},
				],
			],
		},
		{ type: "divider" },
		{ type: "context", text: "Session duration distribution" },
		{
			type: "columns",
			columns: [
				buckets.slice(0, 3).map((b) => ({
					type: "meter",
					label: b.label,
					value: b.count,
					max: bucketMax,
					custom_value: `${b.count} sessions`,
				})),
				buckets.slice(3).map((b) => ({
					type: "meter",
					label: b.label,
					value: b.count,
					max: bucketMax,
					custom_value: `${b.count} sessions`,
				})),
			],
		},
		{ type: "divider" },
		{ type: "context", text: "New vs returning sessions" },
		{
			type: "columns",
			columns: [
				[
					{
						type: "meter",
						label: "New Visitor Sessions",
						value: newSessions,
						max: Math.max(total, 1),
						custom_value: `${newSessions} (${pct(newSessions, total)})`,
					},
				],
				[
					{
						type: "meter",
						label: "Returning Visitor Sessions",
						value: returningSessions,
						max: Math.max(total, 1),
						custom_value: `${returningSessions} (${pct(returningSessions, total)})`,
					},
				],
			],
		},
	];
}

// ── Tab: Devices ──────────────────────────────────────────────────────────────

function buildDevicesTab(data: AnalyticsData): unknown[] {
	const { sessions } = data;
	const total = sessions.length;

	if (total === 0) {
		return [
			{
				type: "banner",
				title: "No device data yet",
				description:
					"Device information is collected from new sessions. Data will appear here once visitors browse your site.",
				variant: "default",
			},
		];
	}

	const deviceTypeCounts = new Map<string, number>();
	const browserCounts = new Map<string, number>();
	const osCounts = new Map<string, number>();
	const resolutionCounts = new Map<string, number>();
	const brandCounts = new Map<string, number>();
	const modelCounts = new Map<string, number>();

	for (const s of sessions) {
		const dt = s.deviceType ?? "unknown";
		deviceTypeCounts.set(dt, (deviceTypeCounts.get(dt) ?? 0) + 1);

		const br = s.browser ?? "Unknown";
		browserCounts.set(br, (browserCounts.get(br) ?? 0) + 1);

		const os = s.os ?? "Unknown";
		osCounts.set(os, (osCounts.get(os) ?? 0) + 1);

		if (s.screenWidth && s.screenHeight) {
			const res = `${s.screenWidth}×${s.screenHeight}`;
			resolutionCounts.set(res, (resolutionCounts.get(res) ?? 0) + 1);
		}

		if (s.deviceBrand) {
			brandCounts.set(s.deviceBrand, (brandCounts.get(s.deviceBrand) ?? 0) + 1);
		}

		const deviceLabel = formatDeviceLabel(s.deviceBrand, s.deviceModel);
		if (deviceLabel) {
			modelCounts.set(deviceLabel, (modelCounts.get(deviceLabel) ?? 0) + 1);
		}
	}

	const desktop = deviceTypeCounts.get("desktop") ?? 0;
	const mobile = deviceTypeCounts.get("mobile") ?? 0;
	const tablet = deviceTypeCounts.get("tablet") ?? 0;
	const unknown = deviceTypeCounts.get("unknown") ?? 0;
	const deviceTotal = Math.max(total, 1);

	const topBrowsers = topN(browserCounts, 10, total);
	const topOS = topN(osCounts, 10, total);
	const topResolutions = topN(resolutionCounts, 10, total);
	const topBrands = topN(brandCounts, 10, total);
	const topModels = topN(modelCounts, 10, total);

	const browserMax = Math.max(topBrowsers[0]?.count ?? 1, 1);
	const osMax = Math.max(topOS[0]?.count ?? 1, 1);

	const blocks: unknown[] = [
		{ type: "context", text: "Device type breakdown — 30 days" },
		{
			type: "stats",
			items: [
				{
					label: "Desktop",
					value: desktop.toLocaleString(),
					description: pct(desktop, deviceTotal),
				},
				{ label: "Mobile", value: mobile.toLocaleString(), description: pct(mobile, deviceTotal) },
				{ label: "Tablet", value: tablet.toLocaleString(), description: pct(tablet, deviceTotal) },
				...(unknown > 0
					? [
							{
								label: "Unknown",
								value: unknown.toLocaleString(),
								description: pct(unknown, deviceTotal),
							},
						]
					: []),
			],
		},
		{
			type: "columns",
			columns: [
				[
					{
						type: "meter",
						label: "Desktop",
						value: desktop,
						max: deviceTotal,
						custom_value: `${desktop.toLocaleString()} (${pct(desktop, deviceTotal)})`,
					},
					{
						type: "meter",
						label: "Mobile",
						value: mobile,
						max: deviceTotal,
						custom_value: `${mobile.toLocaleString()} (${pct(mobile, deviceTotal)})`,
					},
					{
						type: "meter",
						label: "Tablet",
						value: tablet,
						max: deviceTotal,
						custom_value: `${tablet.toLocaleString()} (${pct(tablet, deviceTotal)})`,
					},
				],
				[
					{
						type: "chart",
						config: {
							chart_type: "custom",
							height: 220,
							options: {
								tooltip: { trigger: "item" },
								legend: { bottom: 0, left: "center" },
								series: [
									{
										type: "pie",
										radius: ["40%", "65%"],
										center: ["50%", "45%"],
										data: [
											{ value: desktop, name: "Desktop" },
											{ value: mobile, name: "Mobile" },
											{ value: tablet, name: "Tablet" },
										].filter((d) => d.value > 0),
									},
								],
							},
						},
					},
				],
			],
		},
	];

	if (topBrowsers.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Browser detection — 30 days" });
		blocks.push({
			type: "columns",
			columns: [
				topBrowsers.slice(0, 5).map(({ key, count }) => ({
					type: "meter",
					label: key,
					value: count,
					max: browserMax,
					custom_value: `${count.toLocaleString()} (${pct(count, total)})`,
				})),
				[
					{
						type: "chart",
						config: {
							chart_type: "custom",
							height: 240,
							options: {
								tooltip: { trigger: "item" },
								legend: { type: "scroll", bottom: 0, left: "center" },
								series: [
									{
										type: "pie",
										radius: ["38%", "62%"],
										center: ["50%", "44%"],
										data: topBrowsers
											.slice(0, 6)
											.map(({ key, count }) => ({ value: count, name: key })),
									},
								],
							},
						},
					},
				],
			],
		});
		blocks.push({
			type: "table",
			columns: [
				{ key: "browser", label: "Browser", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topBrowsers.map(({ key, count, share }) => ({ browser: key, sessions: count, share })),
			page_action_id: "noop",
			empty_text: "No browser data",
		});
	}

	if (topOS.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Operating system — 30 days" });
		blocks.push({
			type: "columns",
			columns: [
				topOS.slice(0, 5).map(({ key, count }) => ({
					type: "meter",
					label: key,
					value: count,
					max: osMax,
					custom_value: `${count.toLocaleString()} (${pct(count, total)})`,
				})),
				[
					{
						type: "chart",
						config: {
							chart_type: "custom",
							height: 240,
							options: {
								tooltip: { trigger: "item" },
								legend: { type: "scroll", bottom: 0, left: "center" },
								series: [
									{
										type: "pie",
										radius: ["38%", "62%"],
										center: ["50%", "44%"],
										data: topOS.slice(0, 6).map(({ key, count }) => ({ value: count, name: key })),
									},
								],
							},
						},
					},
				],
			],
		});
		blocks.push({
			type: "table",
			columns: [
				{ key: "os", label: "Operating System", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topOS.map(({ key, count, share }) => ({ os: key, sessions: count, share })),
			page_action_id: "noop",
			empty_text: "No OS data",
		});
	}

	if (topBrands.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Device brands - 30 days" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "brand", label: "Brand", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topBrands.map(({ key, count, share }) => ({ brand: key, sessions: count, share })),
			page_action_id: "noop",
			empty_text: "No brand data",
		});
	}

	if (topModels.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Device models - 30 days" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "device", label: "Brand / Model", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topModels.map(({ key, count, share }) => ({ device: key, sessions: count, share })),
			page_action_id: "noop",
			empty_text: "No device model data",
		});
	}

	if (topResolutions.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Screen resolutions — 30 days" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "resolution", label: "Resolution", format: "text" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topResolutions.map(({ key, count, share }) => ({
				resolution: key,
				sessions: count,
				share,
			})),
			page_action_id: "noop",
			empty_text: "No resolution data",
		});
	}

	return blocks;
}

// ── Tab: Content ──────────────────────────────────────────────────────────────

async function buildContentTab(ctx: PluginContext, sessions: Session[]): Promise<unknown[]> {
	// Aggregate pvday data across last 30 days
	const days = getLast30Days();
	const dayData = await Promise.all(days.map((date) => getContentDay(ctx, date)));

	const urlAgg = new Map<string, ContentCounts>();
	const postAgg = new Map<string, ContentCounts>();
	const pageAgg = new Map<string, ContentCounts>();
	const catAgg = new Map<string, number>();
	const tagAgg = new Map<string, number>();
	const authAgg = new Map<string, number>();

	for (const day of dayData) {
		for (const [url, counts] of Object.entries(day.urls)) {
			const cur = urlAgg.get(url) ?? { v: 0, en: 0, ex: 0 };
			urlAgg.set(url, { v: cur.v + counts.v, en: cur.en + counts.en, ex: cur.ex + counts.ex });
		}
		for (const [url, counts] of Object.entries(day.posts)) {
			const cur = postAgg.get(url) ?? { v: 0, en: 0, ex: 0 };
			postAgg.set(url, { v: cur.v + counts.v, en: cur.en + counts.en, ex: cur.ex + counts.ex });
		}
		for (const [url, counts] of Object.entries(day.pages)) {
			const cur = pageAgg.get(url) ?? { v: 0, en: 0, ex: 0 };
			pageAgg.set(url, { v: cur.v + counts.v, en: cur.en + counts.en, ex: cur.ex + counts.ex });
		}
		for (const [cat, count] of Object.entries(day.cats)) {
			catAgg.set(cat, (catAgg.get(cat) ?? 0) + count);
		}
		for (const [tag, count] of Object.entries(day.tags)) {
			tagAgg.set(tag, (tagAgg.get(tag) ?? 0) + count);
		}
		for (const [auth, count] of Object.entries(day.authors)) {
			authAgg.set(auth, (authAgg.get(auth) ?? 0) + count);
		}
	}

	const totalViews = [...urlAgg.values()].reduce((s, v) => s + v.v, 0);
	const totalPostViews = [...postAgg.values()].reduce((s, v) => s + v.v, 0);
	const totalPageViews = [...pageAgg.values()].reduce((s, v) => s + v.v, 0);

	const topPosts = sortItems(postAgg.entries(), (a, b) => b[1].v - a[1].v)
		.slice(0, 15)
		.map(([url, { v, en, ex }]) => ({
			url,
			views: v,
			entries: en,
			exits: ex,
			share: pct(v, Math.max(totalPostViews, 1)),
		}));

	const topPages = sortItems(pageAgg.entries(), (a, b) => b[1].v - a[1].v)
		.slice(0, 15)
		.map(([url, { v, en, ex }]) => ({
			url,
			views: v,
			entries: en,
			exits: ex,
			share: pct(v, Math.max(totalPageViews, 1)),
		}));

	const topEntryPages = sortItems(urlAgg.entries(), (a, b) => b[1].en - a[1].en)
		.slice(0, 10)
		.map(([url, { en }]) => ({ url, entries: en, share: pct(en, Math.max(totalViews, 1)) }));

	const topExitPages = sortItems(urlAgg.entries(), (a, b) => b[1].ex - a[1].ex)
		.slice(0, 10)
		.map(([url, { ex }]) => ({ url, exits: ex, share: pct(ex, Math.max(totalViews, 1)) }));

	const topCats = topN(catAgg, 15, totalViews);
	const topTags = topN(tagAgg, 20, totalViews);
	const topAuthors = topN(authAgg, 10, totalViews);

	// Also derive entry/exit pages from sessions (fallback if pvday data is sparse)
	const sessionEntries = new Map<string, number>();
	const sessionExits = new Map<string, number>();
	for (const s of sessions) {
		if (s.entryPage) sessionEntries.set(s.entryPage, (sessionEntries.get(s.entryPage) ?? 0) + 1);
		if (s.exitPage) sessionExits.set(s.exitPage, (sessionExits.get(s.exitPage) ?? 0) + 1);
	}
	const sessionTotal = sessions.length;

	const blocks: unknown[] = [];

	if (topPosts.length === 0 && topPages.length === 0) {
		blocks.push({
			type: "banner",
			title: "No content data yet",
			description:
				"Page view data is tracked as visitors browse your site. Add Open Graph meta tags (article:section, article:tag, author) to enrich post/category/tag/author analytics.",
			variant: "default",
		});
		return blocks;
	}

	blocks.push({ type: "context", text: "Content mix - 30 days" });
	blocks.push({
		type: "stats",
		items: [
			{ label: "Post Views", value: totalPostViews.toLocaleString() },
			{ label: "Page Views", value: totalPageViews.toLocaleString() },
			{ label: "Tracked URLs", value: urlAgg.size.toLocaleString() },
			{ label: "Total Views", value: totalViews.toLocaleString() },
		],
	});

	if (topPosts.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Most viewed posts - 30 days" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "url", label: "Post", format: "link" },
				{ key: "views", label: "Views", format: "number" },
				{ key: "entries", label: "Entries", format: "number" },
				{ key: "exits", label: "Exits", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topPosts,
			page_action_id: "noop",
			empty_text: "No post data",
		});
	}

	if (topPages.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Most viewed pages - 30 days" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "url", label: "Page", format: "link" },
				{ key: "views", label: "Views", format: "number" },
				{ key: "entries", label: "Entries", format: "number" },
				{ key: "exits", label: "Exits", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topPages,
			page_action_id: "noop",
			empty_text: "No page data",
		});
	}

	// Entry pages
	const entrySource =
		topEntryPages.length > 0
			? topEntryPages
			: sortItems(sessionEntries.entries(), (a, b) => b[1] - a[1])
					.slice(0, 10)
					.map(([url, entries]) => ({
						url,
						entries,
						share: pct(entries, Math.max(sessionTotal, 1)),
					}));

	if (entrySource.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Entry pages — where sessions start" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "url", label: "Page", format: "link" },
				{ key: "entries", label: "Sessions Started", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: entrySource,
			page_action_id: "noop",
			empty_text: "No entry page data",
		});
	}

	// Exit pages
	const exitSource =
		topExitPages.length > 0
			? topExitPages
			: sortItems(sessionExits.entries(), (a, b) => b[1] - a[1])
					.slice(0, 10)
					.map(([url, exits]) => ({ url, exits, share: pct(exits, Math.max(sessionTotal, 1)) }));

	if (exitSource.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Exit pages — where sessions end" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "url", label: "Page", format: "link" },
				{ key: "exits", label: "Sessions Ended", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: exitSource,
			page_action_id: "noop",
			empty_text: "No exit page data",
		});
	}

	if (topCats.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Top categories — 30 days (from article:section meta)" });
		const catMax = Math.max(topCats[0]?.count ?? 1, 1);
		const catCols: unknown[][] = [[], []];
		topCats.slice(0, 8).forEach(({ key, count }, i) => {
			catCols[i % 2]!.push({
				type: "meter",
				label: key,
				value: count,
				max: catMax,
				custom_value: `${count.toLocaleString()} views (${pct(count, totalViews)})`,
			});
		});
		blocks.push({ type: "columns", columns: catCols.filter((c) => c.length > 0) });
		blocks.push({
			type: "table",
			columns: [
				{ key: "category", label: "Category", format: "text" },
				{ key: "views", label: "Page Views", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topCats.map(({ key, count, share }) => ({ category: key, views: count, share })),
			page_action_id: "noop",
			empty_text: "No category data",
		});
	}

	if (topTags.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Top tags — 30 days (from article:tag meta)" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "tag", label: "Tag", format: "text" },
				{ key: "views", label: "Page Views", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topTags.map(({ key, count, share }) => ({ tag: key, views: count, share })),
			page_action_id: "noop",
			empty_text: "No tag data",
		});
	}

	if (topAuthors.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Author performance — 30 days (from author meta)" });
		const authMax = Math.max(topAuthors[0]?.count ?? 1, 1);
		blocks.push({
			type: "columns",
			columns: [
				topAuthors.slice(0, 5).map(({ key, count }) => ({
					type: "meter",
					label: key,
					value: count,
					max: authMax,
					custom_value: `${count.toLocaleString()} views (${pct(count, totalViews)})`,
				})),
				[
					{
						type: "chart",
						config: {
							chart_type: "custom",
							height: 240,
							options: {
								tooltip: { trigger: "item" },
								legend: { type: "scroll", bottom: 0, left: "center" },
								series: [
									{
										type: "pie",
										radius: ["38%", "62%"],
										center: ["50%", "44%"],
										data: topAuthors
											.slice(0, 6)
											.map(({ key, count }) => ({ value: count, name: key })),
									},
								],
							},
						},
					},
				],
			],
		});
		blocks.push({
			type: "table",
			columns: [
				{ key: "author", label: "Author", format: "text" },
				{ key: "views", label: "Page Views", format: "number" },
				{ key: "share", label: "Share", format: "text" },
			],
			rows: topAuthors.map(({ key, count, share }) => ({ author: key, views: count, share })),
			page_action_id: "noop",
			empty_text: "No author data",
		});
	}

	return blocks;
}

async function buildSeoTab(ctx: PluginContext, request?: Request): Promise<unknown[]> {
	const settings = await getSearchConsoleSettings(ctx);
	const property = resolveSearchConsoleProperty(settings, resolveSiteOrigin(ctx, request));
	const snapshot = await getSearchConsoleSnapshot(ctx, false, request);
	const indexedPages = snapshot?.sitemaps.reduce((sum, sitemap) => sum + sitemap.indexed, 0) ?? 0;
	const submittedPages =
		snapshot?.sitemaps.reduce((sum, sitemap) => sum + sitemap.submitted, 0) ?? 0;

	const blocks: unknown[] = [
		{ type: "context", text: "Search Console integration" },
		{
			type: "form",
			block_id: "search-console-settings",
			fields: [
				{
					type: "toggle",
					action_id: "searchConsoleEnabled",
					label: "Enable Search Console",
					initial_value: settings.enabled,
				},
				{
					type: "text_input",
					action_id: "searchConsoleProperty",
					label: "Property URL or sc-domain",
					initial_value: property,
				},
				{
					type: "secret_input",
					action_id: "searchConsoleAccessToken",
					label: "Access Token",
				},
				{
					type: "text_input",
					action_id: "searchConsoleClientId",
					label: "OAuth Client ID",
					initial_value: settings.clientId,
				},
				{
					type: "secret_input",
					action_id: "searchConsoleClientSecret",
					label: "OAuth Client Secret",
				},
				{
					type: "secret_input",
					action_id: "searchConsoleRefreshToken",
					label: "Refresh Token",
				},
			],
			submit: { label: "Save SEO Settings", action_id: "save_seo_settings" },
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					action_id: "refresh_search_console",
					label: "Refresh Search Console",
					style: "secondary",
				},
			],
		},
	];

	if (!settings.enabled || !property) {
		blocks.push({ type: "divider" });
		blocks.push({
			type: "banner",
			title: "Search Console is not configured",
			description:
				"Enable the integration, add your property, and provide either an access token or refresh-token OAuth credentials.",
			variant: "default",
		});
		return blocks;
	}

	if (snapshot?.error) {
		blocks.push({ type: "divider" });
		blocks.push({
			type: "banner",
			title: "Search Console sync warning",
			description: snapshot.error,
			variant: "default",
		});
	}

	blocks.push({ type: "divider" });
	blocks.push({
		type: "stats",
		items: [
			{
				label: "Clicks",
				value: (snapshot?.totals.clicks ?? 0).toLocaleString(),
				description: "Last 28 days",
			},
			{
				label: "Impressions",
				value: (snapshot?.totals.impressions ?? 0).toLocaleString(),
				description: "Last 28 days",
			},
			{
				label: "CTR",
				value: `${Math.round((snapshot?.totals.ctr ?? 0) * 100)}%`,
				description: "Last 28 days",
			},
			{
				label: "Avg. Position",
				value: (snapshot?.totals.position ?? 0).toFixed(1),
				description: "Google Search",
			},
		],
	});

	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Top search keywords - 28 days" });
	blocks.push({
		type: "table",
		columns: [
			{ key: "keyword", label: "Keyword", format: "text" },
			{ key: "clicks", label: "Clicks", format: "number" },
			{ key: "impressions", label: "Impressions", format: "number" },
			{ key: "ctr", label: "CTR", format: "text" },
			{ key: "position", label: "Position", format: "text" },
		],
		rows: snapshot?.keywords ?? [],
		page_action_id: "noop",
		empty_text: "No keyword data yet",
	});

	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Indexed pages overview" });
	blocks.push({
		type: "stats",
		items: [
			{ label: "Indexed Pages", value: indexedPages.toLocaleString() },
			{ label: "Submitted Pages", value: submittedPages.toLocaleString() },
			{ label: "Sitemaps", value: String(snapshot?.sitemaps.length ?? 0) },
			{
				label: "Last Sync",
				value: snapshot?.fetchedAt
					? new Date(snapshot.fetchedAt).toISOString().slice(0, 16)
					: "Never",
			},
		],
	});
	blocks.push({
		type: "table",
		columns: [
			{ key: "path", label: "Sitemap", format: "text" },
			{ key: "submitted", label: "Submitted", format: "number" },
			{ key: "indexed", label: "Indexed", format: "number" },
			{ key: "lastSubmitted", label: "Last Submitted", format: "text" },
		],
		rows:
			snapshot?.sitemaps.map((sitemap) => ({
				path: sitemap.path,
				submitted: sitemap.submitted,
				indexed: sitemap.indexed,
				lastSubmitted: sitemap.lastSubmitted || "-",
			})) ?? [],
		page_action_id: "noop",
		empty_text: "No sitemap data yet",
	});

	return blocks;
}

// ── Tab: Reports ─────────────────────────────────────────────────────────────

async function buildReportsTab(
	ctx: PluginContext,
	period: ReportPeriod,
	dateFrom?: string,
	dateTo?: string,
): Promise<unknown[]> {
	const periodLabels: Record<ReportPeriod, string> = {
		daily: "Last 30 Days (Daily)",
		weekly: "Last 12 Weeks",
		monthly: "Last 12 Months",
		yearly: "Last 2 Years",
		custom: dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : "Custom Range",
	};
	const periodLabel = periodLabels[period];

	const periodButtons = (["daily", "weekly", "monthly", "yearly", "custom"] as ReportPeriod[]).map(
		(p) => ({
			type: "button",
			action_id: `report:period:${p}`,
			label: p.charAt(0).toUpperCase() + p.slice(1),
			style: p === period ? "primary" : "secondary",
		}),
	);

	const blocks: unknown[] = [
		{ type: "context", text: `Reports — ${periodLabel}` },
		{ type: "actions", elements: periodButtons },
	];

	if (period === "custom" && (!dateFrom || !dateTo)) {
		blocks.push({ type: "divider" });
		blocks.push({
			type: "form",
			fields: [
				{
					type: "date_input",
					action_id: "dateFrom",
					label: "From",
					placeholder: "YYYY-MM-DD",
				},
				{
					type: "date_input",
					action_id: "dateTo",
					label: "To",
					placeholder: "YYYY-MM-DD",
				},
			],
			submit: { label: "Load Report", action_id: "report:custom" },
		});
	} else {
		const days = getReportDays(period, dateFrom, dateTo);
		const rawData = await Promise.all(
			days.map(async (date) => ({ date, s: await getDailyStats(ctx, date) })),
		);
		const aggregated = aggregateForPeriod(rawData, period);

		const totalViews = aggregated.reduce((n, { s }) => n + s.views, 0);
		const totalSessions = aggregated.reduce((n, { s }) => n + s.uniqueSessions, 0);
		const totalNew = aggregated.reduce((n, { s }) => n + s.newVisitors, 0);
		const totalReturning = Math.max(0, totalSessions - totalNew);

		const chartData: [number, number][] = aggregated.map(({ label, s }) => [
			labelToTimestamp(label),
			s.views,
		]);
		const sessionsChartData: [number, number][] = aggregated.map(({ label, s }) => [
			labelToTimestamp(label),
			s.uniqueSessions,
		]);

		const csvRows = aggregated.map(({ label, s }) => ({
			label,
			views: s.views,
			sessions: s.uniqueSessions,
			newVisitors: s.newVisitors,
		}));

		blocks.push({ type: "divider" });
		blocks.push({
			type: "stats",
			items: [
				{ label: "Total Views", value: totalViews.toLocaleString() },
				{ label: "Total Sessions", value: totalSessions.toLocaleString() },
				{ label: "New Visitors", value: totalNew.toLocaleString() },
				{ label: "Returning", value: totalReturning.toLocaleString() },
			],
		});
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: `Trend — ${periodLabel}` });
		blocks.push({
			type: "chart",
			config: {
				chart_type: "timeseries",
				style: period === "daily" ? "bar" : "line",
				gradient: true,
				series: [
					{ name: "Page Views", data: chartData },
					{ name: "Sessions", data: sessionsChartData },
				],
				x_axis_name: "Date",
				y_axis_name: "Count",
				height: 320,
			},
		});
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Data table" });
		blocks.push({
			type: "table",
			columns: [
				{ key: "label", label: "Period", format: "text" },
				{ key: "views", label: "Page Views", format: "number" },
				{ key: "sessions", label: "Sessions", format: "number" },
				{ key: "newVisitors", label: "New Visitors", format: "number" },
			],
			rows: csvRows.reduceRight<typeof csvRows>((acc, row) => {
				acc.push(row);
				return acc;
			}, []),
			page_action_id: "noop",
			empty_text: "No data for this period",
		});
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Export" });
		blocks.push({
			type: "actions",
			elements: [
				{
					type: "button",
					action_id: "report:export:csv",
					label: "Export CSV",
					style: "secondary",
					value: { period, dateFrom, dateTo },
				},
				{
					type: "button",
					action_id: "report:email:now",
					label: "Email Report Now",
					style: "secondary",
					value: { period, dateFrom, dateTo },
				},
			],
		});
	}

	const reportSettings = await getReportSettings(ctx);
	blocks.push({ type: "divider" });
	blocks.push({ type: "context", text: "Scheduled email reports" });
	blocks.push({
		type: "form",
		fields: [
			{
				type: "toggle",
				action_id: "reportEmailEnabled",
				label: "Enable scheduled email reports",
				initial_value: reportSettings.emailEnabled,
			},
			{
				type: "text_input",
				action_id: "reportEmailRecipient",
				label: "Recipient email",
				initial_value: reportSettings.emailRecipient,
				placeholder: "your@email.com",
			},
			{
				type: "select",
				action_id: "reportEmailSchedule",
				label: "Schedule",
				options: [
					{ label: "Daily (8 AM)", value: "daily" },
					{ label: "Weekly (Monday 8 AM)", value: "weekly" },
					{ label: "Monthly (1st, 8 AM)", value: "monthly" },
				],
				initial_value: reportSettings.emailSchedule,
			},
		],
		submit: { label: "Save Email Settings", action_id: "save_report_settings" },
	});

	return blocks;
}

// ── Main Page Assembler ───────────────────────────────────────────────────────

function getAnalyticsRefreshConfig(activeTab: Tab): AutoRefreshConfig | undefined {
	if (activeTab === "seo" || activeTab === "settings") return undefined;
	if (activeTab === "overview") {
		return {
			everyMs: ANALYTICS_AUTO_REFRESH_MS,
			interaction: { type: "page_load", page: "/statistics" },
		};
	}
	return {
		everyMs: ANALYTICS_AUTO_REFRESH_MS,
		interaction: { type: "block_action", action_id: `tab:${activeTab}` },
	};
}

async function buildMainPage(
	ctx: PluginContext,
	activeTab: Tab = "overview",
	request?: Request,
	reportCtx?: { reportPeriod?: ReportPeriod; dateFrom?: string; dateTo?: string },
): Promise<Record<string, unknown>> {
	const skipDataLoad = activeTab === "reports" || activeTab === "settings";

	const [data, last30Raw] = skipDataLoad
		? [null, null]
		: await Promise.all([
				loadAnalyticsData(ctx),
				Promise.all(
					getLast30Days().map(async (date) => ({ date, s: await getDailyStats(ctx, date) })),
				),
			]);
	const siteOrigin = resolveSiteOrigin(ctx, request);

	let tabContent: unknown[];
	switch (activeTab) {
		case "live":
			tabContent = buildLiveTab(data!, siteOrigin);
			break;
		case "traffic":
			tabContent = buildTrafficTab(data!, siteOrigin);
			break;
		case "insights":
			tabContent = buildInsightsTab(data!);
			break;
		case "advanced":
			tabContent = await buildAdvancedTab(ctx, data!);
			break;
		case "sessions":
			tabContent = buildSessionsTab(data!);
			break;
		case "devices":
			tabContent = buildDevicesTab(data!);
			break;
		case "content":
			tabContent = await buildContentTab(ctx, data!.sessions);
			break;
		case "seo":
			tabContent = await buildSeoTab(ctx, request);
			break;
		case "reports":
			tabContent = await buildReportsTab(
				ctx,
				reportCtx?.reportPeriod ?? "daily",
				reportCtx?.dateFrom,
				reportCtx?.dateTo,
			);
			break;
		case "settings":
			tabContent = await buildSettingsTab(ctx);
			break;
		default:
			tabContent = buildOverviewTab(data!, last30Raw!);
	}

	const refresh = getAnalyticsRefreshConfig(activeTab);
	const dashSettings = await getDashboardSettings(ctx);
	const allBlocks = applyDarkMode(
		[
			{ type: "header", text: "Analytics Dashboard" },
			tabBar(activeTab),
			{ type: "divider" },
			...tabContent,
			{ type: "divider" },
			{
				type: "actions",
				elements: [
					{
						type: "button",
						action_id: `tab:${activeTab}`,
						label: "Refresh",
						style: "secondary",
					},
				],
			},
		],
		dashSettings.darkMode,
	);
	return {
		blocks: allBlocks,
		...(dashSettings.darkMode ? { appearance: { themeMode: "dark" as const } } : {}),
		...(refresh ? { refresh } : {}),
	};
}

// ── Widget ────────────────────────────────────────────────────────────────────

async function buildWidgetBlocks(ctx: PluginContext): Promise<Record<string, unknown>> {
	const thirtyDaysAgo = getDateKey(29);

	const [todayStats, yesterdayStats, liveCount, sessionsResult, appearance] = await Promise.all([
		getDailyStats(ctx, getDateKey(0)),
		getDailyStats(ctx, getDateKey(1)),
		getLiveCount(ctx),
		ctx.storage.sessions!.query({
			where: { date: { gte: thirtyDaysAgo } },
			orderBy: { date: "desc" },
			limit: 500,
		}),
		getPluginAppearance(ctx),
	]);

	const viewsTrend = trendOf(todayStats.views, yesterdayStats.views);
	const sessionsTrend = trendOf(todayStats.uniqueSessions, yesterdayStats.uniqueSessions);
	const todaySources = todayStats.sources ?? emptySourceCounts();
	const todayTotal = Math.max(todayStats.uniqueSessions, 1);

	const sessions = sessionsResult.items.map(
		(item: { id: string; data: unknown }) => item.data as Session,
	);

	const countryCounts = new Map<string, number>();
	const deviceTypeCounts = new Map<string, number>();
	for (const s of sessions) {
		if (s.country) countryCounts.set(s.country, (countryCounts.get(s.country) ?? 0) + 1);
		const dt = s.deviceType ?? "unknown";
		deviceTypeCounts.set(dt, (deviceTypeCounts.get(dt) ?? 0) + 1);
	}

	const topCountries = sortItems(countryCounts.entries(), (a, b) => b[1] - a[1]).slice(0, 4);

	const desktop = deviceTypeCounts.get("desktop") ?? 0;
	const mobile = deviceTypeCounts.get("mobile") ?? 0;
	const tablet = deviceTypeCounts.get("tablet") ?? 0;
	const deviceTotal = Math.max(sessions.length, 1);

	const sourceMax = Math.max(todayTotal, 1);

	const blocks: unknown[] = [
		{
			type: "stats",
			items: [
				{ label: "Live Now", value: String(liveCount), description: "Last 5 min" },
				{
					label: "Views Today",
					value: String(todayStats.views),
					...(viewsTrend ? { trend: viewsTrend } : {}),
				},
				{
					label: "Sessions",
					value: String(todayStats.uniqueSessions),
					...(sessionsTrend ? { trend: sessionsTrend } : {}),
				},
				{ label: "Yesterday", value: String(yesterdayStats.views) },
			],
		},
		{ type: "divider" },
		{ type: "context", text: "Traffic sources — today" },
		{
			type: "columns",
			columns: [
				[
					{
						type: "meter",
						label: "Direct",
						value: todaySources.direct,
						max: sourceMax,
						custom_value: `${todaySources.direct} (${pct(todaySources.direct, todayTotal)})`,
					},
					{
						type: "meter",
						label: "Search",
						value: todaySources.search,
						max: sourceMax,
						custom_value: `${todaySources.search} (${pct(todaySources.search, todayTotal)})`,
					},
					{
						type: "meter",
						label: "Social",
						value: todaySources.social,
						max: sourceMax,
						custom_value: `${todaySources.social} (${pct(todaySources.social, todayTotal)})`,
					},
				],
				[
					{
						type: "meter",
						label: "Referral",
						value: todaySources.referral,
						max: sourceMax,
						custom_value: `${todaySources.referral} (${pct(todaySources.referral, todayTotal)})`,
					},
					{
						type: "meter",
						label: "Paid",
						value: todaySources.paid,
						max: sourceMax,
						custom_value: `${todaySources.paid} (${pct(todaySources.paid, todayTotal)})`,
					},
				],
			],
		},
	];

	if (desktop + mobile + tablet > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Device types — 30 days" });
		blocks.push({
			type: "stats",
			items: [
				{ label: "Desktop", value: String(desktop), description: pct(desktop, deviceTotal) },
				{ label: "Mobile", value: String(mobile), description: pct(mobile, deviceTotal) },
				{ label: "Tablet", value: String(tablet), description: pct(tablet, deviceTotal) },
			],
		});
	}

	if (topCountries.length > 0) {
		blocks.push({ type: "divider" });
		blocks.push({ type: "context", text: "Top countries — 30 days" });
		blocks.push({
			type: "stats",
			items: topCountries.map(([code, count]) => ({
				label: `${countryFlag(code)} ${code}`,
				value: String(count),
				description: pct(count, sessions.length),
			})),
		});
	}

	return {
		blocks,
		...(appearance ? { appearance } : {}),
		refresh: {
			everyMs: ANALYTICS_AUTO_REFRESH_MS,
			interaction: { type: "page_load", page: "widget:visit-stats" },
		},
	};
}

// ── Tracking Script ───────────────────────────────────────────────────────────

function buildTrackingScript(trackUrl: string, settings: AdvancedSettings): string {
	return `(function(){
var LS='_em_vid',SS='_em_sid',ST='_em_st',SP='_em_pg';
var u=${JSON.stringify(trackUrl)};
var cfg=${JSON.stringify({
		heatmap: settings.heatmapTrackingEnabled,
		scroll: settings.scrollTrackingEnabled,
		record: settings.sessionRecordingEnabled,
	})};
function snd(d){var b=new Blob([JSON.stringify(d)],{type:'application/json'});if(!navigator.sendBeacon(u,b))fetch(u,{method:'POST',body:JSON.stringify(d),headers:{'Content-Type':'application/json'},keepalive:true}).catch(function(){});}
var vid=localStorage.getItem(LS),isNew=false;
if(!vid){vid=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(LS,vid);isNew=true;}
var sid=sessionStorage.getItem(SS),isNewSess=false;
if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem(SS,sid);sessionStorage.setItem(ST,String(Date.now()));sessionStorage.setItem(SP,'1');isNewSess=true;}else{sessionStorage.setItem(SP,String(parseInt(sessionStorage.getItem(SP)||'1',10)+1));}
var pg=parseInt(sessionStorage.getItem(SP)||'1',10);
var sp=new URLSearchParams(location.search);
var url=location.pathname;
var pgType='',pgAuth='',pgCat='',pgTags=[];
try{
  var mt;
  mt=document.querySelector('meta[property="og:type"]');if(mt)pgType=mt.getAttribute('content')||'';
  mt=document.querySelector('meta[name="author"],meta[property="article:author"]');if(mt)pgAuth=mt.getAttribute('content')||'';
  mt=document.querySelector('meta[property="article:section"]');if(mt)pgCat=mt.getAttribute('content')||'';
  document.querySelectorAll('meta[property="article:tag"]').forEach(function(t){var c=t.getAttribute('content');if(c)pgTags.push(c);});
}catch(e){}
var d={a:'view',vid:vid,sid:sid,isNew:isNew,isNewSess:isNewSess,pg:pg,url:url};
if(pgType)d.pgType=pgType;
if(pgAuth)d.pgAuth=pgAuth;
if(pgCat)d.pgCat=pgCat;
if(pgTags.length)d.pgTags=pgTags;
if(isNewSess){d.ref=document.referrer;d.utmSrc=sp.get('utm_source')||'';d.utmMed=sp.get('utm_medium')||'';d.utmCamp=sp.get('utm_campaign')||'';try{d.lang=navigator.language||'';}catch(e){}try{d.tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}try{var sw=screen.width,sh=screen.height,tp=navigator.maxTouchPoints>0;var dt=tp?(Math.min(sw,sh)<=768?'mobile':'tablet'):'desktop';d.sw=sw;d.sh=sh;d.dt=dt;}catch(e){}}
snd(d);
var t0=parseInt(sessionStorage.getItem(ST)||String(Date.now()),10);
var rec=[];
var lastDepth=0;
var milestones={25:false,50:false,75:false,100:false};
function depth(){var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,1)-window.innerHeight;if(h<=0)return 100;return Math.max(0,Math.min(100,Math.round(window.scrollY/h*100)));}
function pushRec(evt){if(!cfg.record)return;if(rec.length<80)rec.push(evt);}
function flushRec(){if(cfg.record&&rec.length){snd({a:'record',vid:vid,sid:sid,url:url,events:rec.splice(0,rec.length)});}}
function sendScroll(force){if(!cfg.scroll&&!cfg.record)return;var current=depth();if(current<lastDepth&&!force)return;lastDepth=Math.max(lastDepth,current);if(cfg.record)pushRec({type:'scroll',at:Date.now()-t0,page:url,depth:lastDepth});if(!cfg.scroll)return;var changed=false;[25,50,75,100].forEach(function(mark){if(lastDepth>=mark&&!milestones[mark]){milestones[mark]=true;changed=true;}});if(changed||force)snd({a:'scroll',vid:vid,sid:sid,url:url,depth:lastDepth});}
if(cfg.scroll||cfg.record){var scrollTick=0;window.addEventListener('scroll',function(){var now=Date.now();if(now-scrollTick<500)return;scrollTick=now;sendScroll(false);},{passive:true});}
if(cfg.heatmap||cfg.record){document.addEventListener('click',function(event){var target=event.target;if(!(target instanceof Element))return;var rect=(target.getBoundingClientRect&&target.getBoundingClientRect())||null;var x=rect&&rect.width?Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)):0.5;var y=rect&&rect.height?Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height)):0.5;var targetLabel=(target.tagName||'').toLowerCase()+(target.id?('#'+target.id):'');if(cfg.heatmap)snd({a:'heat',vid:vid,sid:sid,url:url,x:x,y:y,target:targetLabel.slice(0,64)});pushRec({type:'click',at:Date.now()-t0,page:url,x:x,y:y,target:targetLabel.slice(0,64)});},true);}
pushRec({type:'navigate',at:0,page:url});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){sendScroll(true);flushRec();snd({a:'end',vid:vid,sid:sid,dur:Math.floor((Date.now()-t0)/1000),pg:parseInt(sessionStorage.getItem(SP)||'1',10),url:url});}});
setInterval(function(){snd({a:'ping',vid:vid,sid:sid});},30000);
})();`;
}

// ── Widget: Traffic Chart ─────────────────────────────────────────────────────

async function buildTrafficChartWidget(ctx: PluginContext): Promise<Record<string, unknown>> {
	const [dashSettings, last30Raw] = await Promise.all([
		getDashboardSettings(ctx),
		Promise.all(getLast30Days().map(async (date) => ({ date, s: await getDailyStats(ctx, date) }))),
	]);

	const chartData: [number, number][] = last30Raw.map(({ date, s }) => [
		labelToTimestamp(date),
		s.views,
	]);
	const sessionsData: [number, number][] = last30Raw.map(({ date, s }) => [
		labelToTimestamp(date),
		s.uniqueSessions,
	]);

	const totalViews = last30Raw.reduce((n, { s }) => n + s.views, 0);
	const totalSessions = last30Raw.reduce((n, { s }) => n + s.uniqueSessions, 0);
	const dark = dashSettings.darkMode;

	const blocks: unknown[] = [
		{
			type: "stats",
			items: [
				{ label: "Total Views (30d)", value: totalViews.toLocaleString() },
				{ label: "Total Sessions (30d)", value: totalSessions.toLocaleString() },
			],
		},
		{ type: "divider" },
		{
			type: "chart",
			config: {
				chart_type: "timeseries",
				style: "bar",
				gradient: true,
				series: [
					{ name: "Page Views", data: chartData },
					{ name: "Sessions", data: sessionsData },
				],
				x_axis_name: "Date",
				y_axis_name: "Count",
				height: 260,
				...(dark
					? {
							options: {
								backgroundColor: "#1a1a2e",
								textStyle: { color: "#ccc" },
							},
						}
					: {}),
			},
		},
	];

	return {
		blocks,
		...(dashSettings.darkMode ? { appearance: { themeMode: "dark" as const } } : {}),
	};
}

// ── Widget: Live Counter ──────────────────────────────────────────────────────

async function buildLiveCounterWidget(ctx: PluginContext): Promise<Record<string, unknown>> {
	const [liveVisitors, todayStats, yesterdayStats, appearance] = await Promise.all([
		getActiveLiveVisitors(ctx),
		getDailyStats(ctx, getDateKey(0)),
		getDailyStats(ctx, getDateKey(1)),
		getPluginAppearance(ctx),
	]);

	const sourceCounts = new Map<string, number>();
	for (const v of liveVisitors) {
		sourceCounts.set(v.source, (sourceCounts.get(v.source) ?? 0) + 1);
	}

	const viewsTrend = trendOf(todayStats.views, yesterdayStats.views);

	const blocks: unknown[] = [
		{
			type: "stats",
			items: [
				{
					label: "Live Now",
					value: String(liveVisitors.length),
					description: "Active last 5 min",
				},
				{
					label: "Views Today",
					value: String(todayStats.views),
					...(viewsTrend ? { trend: viewsTrend } : {}),
				},
				{
					label: "Sessions Today",
					value: String(todayStats.uniqueSessions),
				},
			],
		},
	];

	if (liveVisitors.length > 0) {
		const topCountries = sortItems(
			[
				...liveVisitors.reduce((m, v) => {
					if (v.country) m.set(v.country, (m.get(v.country) ?? 0) + 1);
					return m;
				}, new Map<string, number>()),
			],
			(a, b) => b[1] - a[1],
		).slice(0, 3);

		if (topCountries.length > 0) {
			blocks.push({ type: "divider" });
			blocks.push({ type: "context", text: "Live visitors by country" });
			blocks.push({
				type: "stats",
				items: topCountries.map(([country, count]) => ({
					label: `${countryFlag(country)} ${country}`,
					value: String(count),
				})),
			});
		}
	}

	return { blocks, ...(appearance ? { appearance } : {}) };
}

// ── Plugin Definition ─────────────────────────────────────────────────────────

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Statistics Em plugin installed");
			await ctx.cron?.schedule("email-report", { schedule: "0 8 * * 1" });
		},

		cron: async (
			event: { name: string; data?: Record<string, unknown>; scheduledAt: string },
			ctx: PluginContext,
		) => {
			if (event.name !== "email-report") return;
			const settings = await getReportSettings(ctx);
			if (!settings.emailEnabled || !settings.emailRecipient) return;
			const period: ReportPeriod =
				settings.emailSchedule === "daily"
					? "daily"
					: settings.emailSchedule === "monthly"
						? "monthly"
						: "weekly";
			const days = getReportDays(period);
			const rawData = await Promise.all(
				days.map(async (date) => ({ date, s: await getDailyStats(ctx, date) })),
			);
			const aggregated = aggregateForPeriod(rawData, period);
			const csvRows = aggregated.map(({ label, s }) => ({
				label,
				views: s.views,
				sessions: s.uniqueSessions,
				newVisitors: s.newVisitors,
			}));
			const periodLabels: Record<ReportPeriod, string> = {
				daily: "Last 30 Days",
				weekly: "Last 12 Weeks",
				monthly: "Last 12 Months",
				yearly: "Last 2 Years",
				custom: "Custom Range",
			};
			await sendAnalyticsEmail(ctx, periodLabels[period], csvRows, settings.emailRecipient);
			ctx.log.info("Analytics report sent", { recipient: settings.emailRecipient, period });
			await checkAndFireAlerts(ctx);
		},

		"page:fragments": {
			errorPolicy: "continue",
			handler: async (_event: unknown, ctx: PluginContext) => {
				const trackUrl = "/_emdash/api/plugins/statistics-em/track";
				const advancedSettings = await getAdvancedSettings(ctx);
				return [
					{
						kind: "inline-script",
						placement: "body:end",
						code: buildTrackingScript(trackUrl, advancedSettings),
					},
				];
			},
		},
	},

	routes: {
		track: {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const input = routeCtx.input as {
					a?: string;
					vid?: string;
					sid?: string;
					isNew?: boolean;
					isNewSess?: boolean;
					pg?: number;
					dur?: number;
					ref?: string;
					utmSrc?: string;
					utmMed?: string;
					utmCamp?: string;
					lang?: string;
					tz?: string;
					url?: string;
					dt?: DeviceType;
					sw?: number;
					sh?: number;
					pgType?: string;
					pgAuth?: string;
					pgCat?: string;
					pgTags?: string[];
					depth?: number;
					x?: number;
					y?: number;
					target?: string;
					events?: RecordingEvent[];
				};

				const { a: action = "view", vid, sid } = input;
				if (!isSafeId(vid) || !isSafeId(sid)) return { ok: false };

				const date = getDateKey(0);
				const meta = routeCtx.requestMeta;
				const siteOrigin = resolveSiteOrigin(ctx, routeCtx.request);
				const pageUrl = normalizeTrackedPath(
					truncate(input.url ?? "", 1024),
					siteOrigin,
				);
				const contentKind = classifyContentKind(input);
				const now = Date.now();
				const incomingReferrer = truncate(
					input.ref ?? meta.referer ?? "",
					512,
				);

				if (action === "ping") {
					const existingSession = await ctx.storage.sessions!.get(sid);
					if (existingSession) {
						const sess = existingSession as Session;
						if (sess.visitorId !== vid) return { ok: false };
						await upsertLive(ctx, {
							sessionId: sid,
							visitorId: vid,
							startedAt: sess.startTime,
							lastSeen: now,
							pageUrl: sess.exitPage || sess.entryPage || "",
							referrer: sess.referrer,
							source: sess.source,
							country: sess.country,
							region: sess.region,
							city: sess.city,
						});
					}
					return { ok: true };
				}

				if (action === "scroll") {
					const depth = clampPercent(input.depth ?? 0);
					const existing = await ctx.storage.sessions!.get(sid);
					if (existing) {
						const sess = existing as Session;
						if (sess.visitorId !== vid) return { ok: false };
						await ctx.storage.sessions!.put(sid, {
							...sess,
							lastSeen: now,
							maxScrollDepth: Math.max(sess.maxScrollDepth ?? 0, depth),
						} satisfies Session);
					}
					if (pageUrl) {
						const day = await getScrollDay(ctx, date);
						const page = day.pages[pageUrl] ?? {
							views: 0,
							totalDepth: 0,
							maxDepth: 0,
							buckets: {},
						};
						page.views += 1;
						page.totalDepth += depth;
						page.maxDepth = Math.max(page.maxDepth, depth);
						for (const mark of [25, 50, 75, 100]) {
							if (depth >= mark) page.buckets[String(mark)] = (page.buckets[String(mark)] ?? 0) + 1;
						}
						day.pages[pageUrl] = page;
						await ctx.kv.set(`scroll:${date}`, day);
					}
					return { ok: true };
				}

				if (action === "heat") {
					if (pageUrl) {
						const day = await getHeatmapDay(ctx, date);
						const page = day.pages[pageUrl] ?? { clicks: 0, zones: {} };
						page.clicks += 1;
						const zone = zoneLabelFromCoordinates(input.x ?? 0.5, input.y ?? 0.5);
						page.zones[zone] = (page.zones[zone] ?? 0) + 1;
						day.pages[pageUrl] = page;
						await ctx.kv.set(`heat:${date}`, day);
					}
					return { ok: true };
				}

				if (action === "record") {
					const events = Array.isArray(input.events)
						? input.events
								.slice(0, 80)
								.filter((event): event is RecordingEvent => isRecordingEvent(event))
						: [];
					if (events.length === 0) return { ok: true };
					const existingRecording = await ctx.kv.get<SessionRecording>(`recording:${sid}`);
					const existingSession = await ctx.storage.sessions!.get(sid);
					if (existingSession && (existingSession as Session).visitorId !== vid)
						return { ok: false };
					const pages = appendVisitedPage(existingRecording?.pages, pageUrl);
					const recording: SessionRecording = {
						sessionId: sid,
						visitorId: vid,
						startedAt:
							existingRecording?.startedAt ?? (existingSession as Session | null)?.startTime ?? now,
						updatedAt: now,
						pages,
						events: [...(existingRecording?.events ?? []), ...events].slice(-120),
					};
					await ctx.kv.set(`recording:${sid}`, recording);
					if (existingSession) {
						const session = existingSession as Session;
						await ctx.storage.sessions!.put(sid, {
							...session,
							lastSeen: now,
							recordingEventCount: (session.recordingEventCount ?? 0) + events.length,
							recordingUpdatedAt: now,
						} satisfies Session);
					}
					return { ok: true };
				}

				if (action === "end") {
					const existing = await ctx.storage.sessions!.get(sid);
					if (existing) {
						const sess = existing as Session;
						if (sess.visitorId !== vid) return { ok: false };
						await ctx.storage.sessions!.put(sid, {
							...sess,
							lastSeen: now,
							pageViews: Math.max(sess.pageViews, input.pg ?? sess.pageViews),
							exitPage: pageUrl || sess.exitPage,
						} satisfies Session);

						// Track exit page in pvday
						if (pageUrl) {
							const day = await getContentDay(ctx, date);
							updateContentCounts(day.urls, pageUrl, { ex: 1 });
							updateContentCounts(
								contentBucket(day, sess.lastContentKind ?? contentKind),
								pageUrl,
								{
									ex: 1,
								},
							);
							await ctx.kv.set(`pvday:${date}`, day);
						}
					}
					await removeLiveVisitor(ctx, sid);
					return { ok: true };
				}

				const daily = await getDailyStats(ctx, date);
				if (!daily.sources) daily.sources = emptySourceCounts();
				daily.views += 1;

				const existingSession = await ctx.storage.sessions!.get(sid);

				if (!existingSession || input.isNewSess) {
					daily.uniqueSessions += 1;

					const ref = incomingReferrer;
					const utmMed = truncate(input.utmMed ?? "", 128);
					const source = classifySource(ref, utmMed, siteOrigin);
					daily.sources[source] += 1;

					const knownVisitor = await ctx.kv.get<{ firstSeen: string }>(`visitor:${vid}`);
					const isNewVisitor = !knownVisitor;
					if (isNewVisitor) {
						daily.newVisitors += 1;
						await ctx.kv.set(`visitor:${vid}`, { firstSeen: date });
					}

					const rawIp = meta.ip ?? "";
					const ipHash = rawIp ? await hashIp(rawIp) : "";
					const deviceInfo = parseUA(meta.userAgent ?? "");
					const advancedSettings = await getAdvancedSettings(ctx);
					const experimentAssignments = advancedSettings.abTestingEnabled
						? assignExperimentVariants(
								vid,
								pageUrl,
								parseExperimentConfigs(advancedSettings.abExperiments),
							)
						: {};

					await ctx.storage.sessions!.put(sid, {
						id: sid,
						visitorId: vid,
						date,
						startTime: now,
						lastSeen: now,
						pageViews: 1,
						isNew: isNewVisitor,
						source,
						referrer: ref,
						utmSource: truncate(input.utmSrc ?? "", 128),
						utmMedium: utmMed,
						utmCampaign: truncate(input.utmCamp ?? "", 128),
						country: meta.geo?.country ?? "",
						region: meta.geo?.region ?? "",
						city: meta.geo?.city ?? "",
						language: truncate(input.lang ?? "", 32),
						timezone: truncate(input.tz ?? "", 64),
						ipHash,
						deviceType: VALID_DEVICE_TYPES.has(input.dt ?? "")
							? (input.dt as DeviceType)
							: "unknown",
						browser: deviceInfo.browser,
						browserVersion: deviceInfo.browserVersion,
						os: deviceInfo.os,
						osVersion: deviceInfo.osVersion,
						deviceBrand: deviceInfo.deviceBrand,
						deviceModel: deviceInfo.deviceModel,
						screenWidth: Math.max(0, Math.min(7680, Math.floor(input.sw ?? 0))),
						screenHeight: Math.max(0, Math.min(4320, Math.floor(input.sh ?? 0))),
						entryPage: pageUrl,
						exitPage: pageUrl,
						lastContentKind: contentKind,
						maxScrollDepth: 0,
						visitedPages: pageUrl ? [pageUrl] : [],
						recordingEventCount: 0,
						recordingUpdatedAt: 0,
						experiments: experimentAssignments,
					} satisfies Session);
				} else {
					const sess = existingSession as Session;
					await ctx.storage.sessions!.put(sid, {
						...sess,
						lastSeen: now,
						pageViews: sess.pageViews + 1,
						exitPage: pageUrl || sess.exitPage,
						lastContentKind: contentKind,
						visitedPages: pageUrl
							? appendVisitedPage(sess.visitedPages, pageUrl)
							: sess.visitedPages,
					} satisfies Session);
				}

				const liveSource =
					!existingSession || input.isNewSess
						? classifySource(incomingReferrer, input.utmMed ?? "", siteOrigin)
						: (existingSession as Session).source;
				const liveSession = (await ctx.storage.sessions!.get(sid)) as Session | null;
				if (liveSession) {
					await upsertLive(ctx, {
						sessionId: sid,
						visitorId: vid,
						startedAt: liveSession.startTime,
						lastSeen: now,
						pageUrl: pageUrl || liveSession.exitPage || liveSession.entryPage || "",
						referrer: liveSession.referrer || incomingReferrer,
						source: liveSource,
						country: liveSession.country,
						region: liveSession.region,
						city: liveSession.city,
					});
				}

				await ctx.kv.set(`daily:${date}`, daily);

				// Update content day (URL views + cats/tags/authors)
				if (pageUrl || input.pgCat || input.pgTags?.length || input.pgAuth) {
					const day = await getContentDay(ctx, date);
					if (pageUrl) {
						const isEntry = !existingSession || !!input.isNewSess;
						updateContentCounts(day.urls, pageUrl, { v: 1, en: isEntry ? 1 : 0 });
						updateContentCounts(contentBucket(day, contentKind), pageUrl, {
							v: 1,
							en: isEntry ? 1 : 0,
						});
					}
					if (input.pgCat) {
						day.cats[truncate(input.pgCat, 128)] =
							(day.cats[truncate(input.pgCat, 128)] ?? 0) + 1;
					}
					if (input.pgTags) {
						for (const tag of input.pgTags.slice(0, 20)) {
							const safeTag = truncate(tag, 128);
							day.tags[safeTag] = (day.tags[safeTag] ?? 0) + 1;
						}
					}
					if (input.pgAuth) {
						day.authors[truncate(input.pgAuth, 128)] =
							(day.authors[truncate(input.pgAuth, 128)] ?? 0) + 1;
					}
					await ctx.kv.set(`pvday:${date}`, day);
				}

				return { ok: true };
			},
		},

		admin: {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const interaction = routeCtx.input as {
					type: string;
					page?: string;
					action_id?: string;
					value?: unknown;
					values?: Record<string, unknown>;
				};

				const { type, page, action_id } = interaction;
				const localizeAdminResult = <T>(value: T) =>
					localizeStatisticsPayload(ctx, value, routeCtx.request);

				if (type === "page_load" && page === "/statistics") {
					return localizeAdminResult(await buildMainPage(ctx, "overview", routeCtx.request));
				}
				if (type === "page_load" && page === "/statistics/settings") {
					return localizeAdminResult(await buildMainPage(ctx, "settings", routeCtx.request));
				}
				if (type === "page_load" && page === "widget:visit-stats") {
					return localizeAdminResult(await buildWidgetBlocks(ctx));
				}
				if (type === "page_load" && page === "widget:traffic-chart") {
					return localizeAdminResult(await buildTrafficChartWidget(ctx));
				}
				if (type === "page_load" && page === "widget:live-counter") {
					return localizeAdminResult(await buildLiveCounterWidget(ctx));
				}
				if (type === "form_submit" && action_id === "save_dashboard_settings") {
					await saveDashboardSettings(ctx, interaction.values ?? {});
					return localizeAdminResult({
						...(await buildMainPage(ctx, "settings", routeCtx.request)),
						toast: { message: "Dashboard settings saved", type: "success" },
					});
				}
				if (type === "form_submit" && action_id === "save_access_settings") {
					await saveDashboardSettings(ctx, interaction.values ?? {});
					return localizeAdminResult({
						...(await buildMainPage(ctx, "settings", routeCtx.request)),
						toast: { message: "Access settings saved", type: "success" },
					});
				}
				if (type === "form_submit" && action_id === "save_alert_settings") {
					await saveAlertSettings(ctx, interaction.values ?? {});
					return localizeAdminResult({
						...(await buildMainPage(ctx, "settings", routeCtx.request)),
						toast: { message: "Alert settings saved", type: "success" },
					});
				}
				if (type === "form_submit" && action_id === "save_advanced_settings") {
					await saveAdvancedSettings(ctx, interaction.values ?? {});
					return localizeAdminResult({
						...(await buildMainPage(ctx, "settings", routeCtx.request)),
						toast: { message: "Advanced analytics settings saved", type: "success" },
					});
				}
				if (type === "form_submit" && action_id === "save_seo_settings") {
					await saveSearchConsoleSettings(ctx, interaction.values ?? {});
					return localizeAdminResult({
						...(await buildMainPage(ctx, "seo", routeCtx.request)),
						toast: { message: "SEO settings saved", type: "success" },
					});
				}
				if (type === "block_action" && action_id === "refresh_search_console") {
					await getSearchConsoleSnapshot(ctx, true, routeCtx.request);
					return localizeAdminResult({
						...(await buildMainPage(ctx, "seo", routeCtx.request)),
						toast: { message: "Search Console refreshed", type: "success" },
					});
				}
				// ── Report period switching ────────────────────────────────────
				if (type === "block_action" && action_id?.startsWith("report:period:")) {
					const period = action_id.slice("report:period:".length) as ReportPeriod;
					const validPeriods: ReportPeriod[] = ["daily", "weekly", "monthly", "yearly", "custom"];
					const safePeriod = validPeriods.includes(period) ? period : "daily";
					return localizeAdminResult(
						await buildMainPage(ctx, "reports", routeCtx.request, { reportPeriod: safePeriod }),
					);
				}
				// ── Custom date range form ────────────────────────────────────
				if (type === "form_submit" && action_id === "report:custom") {
					const values = interaction.values ?? {};
					const rawFrom = getString(values, "dateFrom");
					const rawTo = getString(values, "dateTo");
					const dateFrom = isSafeDateKey(rawFrom) ? rawFrom : "";
					const dateTo = isSafeDateKey(rawTo) ? rawTo : "";
					return localizeAdminResult(
						await buildMainPage(ctx, "reports", routeCtx.request, {
							reportPeriod: "custom",
							dateFrom,
							dateTo,
						}),
					);
				}
				// ── CSV export ────────────────────────────────────────────────
				if (type === "block_action" && action_id === "report:export:csv") {
					const val = (interaction.value ?? {}) as {
						period?: string;
						dateFrom?: string;
						dateTo?: string;
					};
					const period = (val.period ?? "daily") as ReportPeriod;
					const days = getReportDays(period, val.dateFrom, val.dateTo);
					const rawData = await Promise.all(
						days.map(async (date) => ({ date, s: await getDailyStats(ctx, date) })),
					);
					const aggregated = aggregateForPeriod(rawData, period);
					const csvRows = aggregated.map(({ label, s }) => ({
						label,
						views: s.views,
						sessions: s.uniqueSessions,
						newVisitors: s.newVisitors,
					}));
					const csv = generateCsv(csvRows, getStatisticsLocale(ctx, routeCtx.request));
					return localizeAdminResult({
						blocks: [
							{ type: "header", text: "CSV Export" },
							{
								type: "context",
								text: "Copy the data below and save as a .csv file to open in Excel or Google Sheets.",
							},
							{ type: "code", code: csv, language: "bash" },
							{ type: "divider" },
							{
								type: "actions",
								elements: [
									{
										type: "button",
										action_id: `report:period:${period}`,
										label: "← Back to Reports",
										style: "secondary",
									},
								],
							},
						],
					});
				}
				// ── Email report now ──────────────────────────────────────────
				if (type === "block_action" && action_id === "report:email:now") {
					const val = (interaction.value ?? {}) as {
						period?: string;
						dateFrom?: string;
						dateTo?: string;
					};
					const period = (val.period ?? "daily") as ReportPeriod;
					const reportCtx = { reportPeriod: period, dateFrom: val.dateFrom, dateTo: val.dateTo };
					const settings = await getReportSettings(ctx);
					if (!settings.emailEnabled || !settings.emailRecipient) {
						return localizeAdminResult({
							...(await buildMainPage(ctx, "reports", routeCtx.request, reportCtx)),
							toast: {
								message: "Enable email reports and set a recipient first",
								type: "error",
							},
						});
					}
					try {
						const days = getReportDays(period, val.dateFrom, val.dateTo);
						const rawData = await Promise.all(
							days.map(async (date) => ({ date, s: await getDailyStats(ctx, date) })),
						);
						const aggregated = aggregateForPeriod(rawData, period);
						const csvRows = aggregated.map(({ label, s }) => ({
							label,
							views: s.views,
							sessions: s.uniqueSessions,
							newVisitors: s.newVisitors,
						}));
						const periodLabels: Record<ReportPeriod, string> = {
							daily: "Last 30 Days",
							weekly: "Last 12 Weeks",
							monthly: "Last 12 Months",
							yearly: "Last 2 Years",
							custom:
								val.dateFrom && val.dateTo ? `${val.dateFrom} → ${val.dateTo}` : "Custom Range",
						};
						await sendAnalyticsEmail(ctx, periodLabels[period], csvRows, settings.emailRecipient);
						return localizeAdminResult({
							...(await buildMainPage(ctx, "reports", routeCtx.request, reportCtx)),
							toast: { message: `Report sent to ${settings.emailRecipient}`, type: "success" },
						});
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						return localizeAdminResult({
							...(await buildMainPage(ctx, "reports", routeCtx.request, reportCtx)),
							toast: { message: `Failed to send: ${msg}`, type: "error" },
						});
					}
				}
				// ── Report email settings ─────────────────────────────────────
				if (type === "form_submit" && action_id === "save_report_settings") {
					await saveReportSettings(ctx, interaction.values ?? {});
					return localizeAdminResult({
						...(await buildMainPage(ctx, "reports", routeCtx.request)),
						toast: { message: "Email report settings saved", type: "success" },
					});
				}
				// ── Tab switching ─────────────────────────────────────────────
				if (type === "block_action" && action_id?.startsWith("tab:")) {
					const tab = action_id.slice(4) as Tab;
					const validTabs: Tab[] = [
						"overview",
						"live",
						"traffic",
						"insights",
						"advanced",
						"sessions",
						"devices",
						"content",
						"seo",
						"reports",
						"settings",
					];
					return localizeAdminResult(
						await buildMainPage(ctx, validTabs.includes(tab) ? tab : "overview", routeCtx.request),
					);
				}
				return localizeAdminResult({ blocks: [] });
			},
		},
	},
});
