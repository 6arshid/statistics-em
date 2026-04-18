//#region src/index.ts
function statisticsEm() {
	const analyticsLabel = {
		en: "Analytics",
		ar: "التحليلات"
	};
	return {
		id: "statistics-em",
		version: "2.1.0",
		format: "standard",
		entrypoint: "@6arshid/statistics-em/sandbox",
		capabilities: [
			"page:inject",
			"network:fetch",
			"email:send",
			"read:users"
		],
		allowedHosts: ["www.googleapis.com", "oauth2.googleapis.com"],
		storage: { sessions: { indexes: ["date", "visitorId"] } },
		features: [
			"privacy:cookie-free",
			"privacy:gdpr-ready",
			"privacy:ccpa-ready",
			"privacy:dnt-support",
			"privacy:ip-anonymization",
			"privacy:data-delete",
			"analytics:heatmap-tracking",
			"analytics:scroll-tracking",
			"analytics:session-recording",
			"analytics:funnel-analytics",
			"analytics:ab-testing",
			"analytics:cohort-analysis",
			"perf:lightweight-script",
			"perf:cache-compatible",
			"perf:cdn-compatible",
			"perf:db-optimized",
			"perf:auto-clean",
			"perf:high-traffic"
		],
		adminWidgets: [
			{
				id: "visit-stats",
				title: analyticsLabel,
				size: "half"
			},
			{
				id: "traffic-chart",
				title: {
					en: "30-Day Traffic",
					ar: "زيارات 30 يومًا"
				},
				size: "full"
			},
			{
				id: "live-counter",
				title: {
					en: "Live Visitors",
					ar: "الزوار المباشرون"
				},
				size: "third"
			}
		],
		adminPages: [{
			path: "/statistics",
			label: analyticsLabel,
			icon: "chart-line"
		}, {
			path: "/statistics/settings",
			label: {
				en: "Analytics Settings",
				ar: "إعدادات التحليلات"
			},
			icon: "gear"
		}]
	};
}

//#endregion
export { statisticsEm };
//# sourceMappingURL=index.mjs.map