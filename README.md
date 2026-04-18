# statistics-em

[![GitHub](https://img.shields.io/badge/GitHub-6arshid%2Fstatistics--em-181717?logo=github)](https://github.com/6arshid/statistics-em)

A privacy-focused, full-featured analytics plugin for [EmDash CMS](https://github.com/emdash-cms/emdash). Tracks visitors, sessions, devices, content performance, and SEO metrics — all without cookies or third-party scripts.

---

## Features

### Core Analytics
- **Live visitors** — real-time active user counter with 15-second auto-refresh
- **Page views** — today, yesterday, and 30-day trend chart
- **Traffic sources** — direct, search, social, referral, paid with UTM campaign tracking
- **Session insights** — bounce rate, avg. duration, new vs. returning, multi-page sessions

### Advanced Tracking
| Feature | Description |
|---|---|
| Heatmaps | Aggregate click zones per page |
| Scroll depth | Track max scroll % and per-page distribution |
| Session recording | Privacy-safe timeline of clicks, scrolls, and navigation |
| Funnel analytics | Step-by-step conversion measurement |
| A/B testing | Variant assignment and goal-path tracking |
| Cohort analysis | Weekly retention tracking for new visitors |

### Device & Geo Data
- Device type (desktop / mobile / tablet)
- Browser, OS, screen resolution
- Device brand & model (Samsung, Apple, Google Pixel, Xiaomi, etc.)
- Country, region, city

### Content Analytics
- Top posts and pages by views, entries, and exits
- Category, tag, and author breakdowns
- Parses Open Graph and `article:*` meta tags automatically

### SEO — Google Search Console Integration
- Keywords, impressions, clicks, CTR
- Indexed pages and sitemaps
- OAuth 2.0 authentication with 15-minute cache

### Reports & Alerts
- Custom date range reports with CSV export
- Scheduled email reports (daily / weekly / monthly)
- Configurable alerts for traffic spikes, bounce rate changes, and all-time records

### Privacy & Compliance
- Cookie-free tracking
- IP anonymization (hashed)
- GDPR, CCPA, and DNT support
- Built-in data deletion

---

## Dashboard Tabs

1. **Overview** — summary, 30-day trend, live count
2. **Live** — active visitors, pages, referrers, geo map, visitor feed
3. **Traffic** — source breakdown, UTM, referrals
4. **Insights** — bounce rate, session quality, segmentation
5. **Advanced** — heatmaps, scroll, recordings, funnels, A/B, cohorts
6. **Sessions** — duration distribution, engagement metrics
7. **Devices** — browser, OS, brand, model, resolution
8. **Content** — top posts/pages, entry/exit, categories, tags, authors
9. **SEO** — Search Console metrics
10. **Reports** — export and email scheduling
11. **Settings** — all configuration options

---

## Installation

```bash
npm install @6arshid/statistics-em
```

Register the plugin in your EmDash config:

```ts
import statisticsEm from '@6arshid/statistics-em'

export default defineConfig({
  plugins: [statisticsEm()],
})
```

---

## Configuration

All settings are available via the **Analytics Settings** admin page (`/statistics/settings`).

### Dashboard

| Option | Type | Default | Description |
|---|---|---|---|
| `darkMode` | `boolean` | `false` | Dark theme for charts and graphs |
| `minViewRole` | `number` | `50` | Minimum role level to view analytics |
| `multiSiteLabel` | `string` | — | Label shown in multi-site reports |
| `defaultReportPeriod` | `string` | `monthly` | Default period: `daily` \| `weekly` \| `monthly` \| `yearly` \| `custom` |

**Role levels:** Subscriber=10, Contributor=20, Author=30, Editor=40, Admin=50

### Advanced Tracking

| Option | Type | Description |
|---|---|---|
| `heatmapTrackingEnabled` | `boolean` | Enable click heatmaps |
| `scrollTrackingEnabled` | `boolean` | Enable scroll depth tracking |
| `sessionRecordingEnabled` | `boolean` | Enable session event recording |
| `funnelAnalyticsEnabled` | `boolean` | Enable funnel analysis |
| `funnelSteps` | `string` | Comma-separated URL paths |
| `abTestingEnabled` | `boolean` | Enable A/B testing |
| `abExperiments` | `string` | Rules: `name@prefix->goal:varA,varB` |
| `cohortAnalysisEnabled` | `boolean` | Enable weekly retention cohorts |

### Alerts

| Option | Type | Description |
|---|---|---|
| `viewsEnabled` | `boolean` | Alert on daily view threshold |
| `viewsThreshold` | `number` | Threshold value |
| `viewsRecipient` | `string` | Email recipient |
| `bounceEnabled` | `boolean` | Alert on bounce rate change |
| `bounceThreshold` | `number` | Bounce rate % threshold |
| `newRecordEnabled` | `boolean` | Alert on all-time traffic record |

### Google Search Console

| Option | Type | Description |
|---|---|---|
| `searchConsoleEnabled` | `boolean` | Enable GSC integration |
| `searchConsoleProperty` | `string` | Property URL or `sc-domain:example.com` |
| `searchConsoleAccessToken` | `string` | Direct access token |
| `searchConsoleRefreshToken` | `string` | OAuth refresh token |
| `searchConsoleClientId` | `string` | OAuth client ID |
| `searchConsoleClientSecret` | `string` | OAuth client secret |

### Email Reports

| Option | Type | Description |
|---|---|---|
| `emailEnabled` | `boolean` | Enable scheduled reports |
| `emailRecipient` | `string` | Delivery address |
| `emailSchedule` | `string` | `daily` \| `weekly` \| `monthly` |

---

## How It Works

A lightweight (~3.5 KB minified) script is injected into every page. It uses `sendBeacon()` with a `fetch()` fallback and sends the following events:

| Event | Trigger |
|---|---|
| `view` | Page load — captures path, referrer, UTM, meta tags, device info |
| `scroll` | Scroll milestones: 25%, 50%, 75%, 100% (throttled 500ms) |
| `heat` | Click coordinates relative to element |
| `record` | Interaction timeline (navigate, scroll, click) |
| `ping` | Keep-alive every 30 seconds |
| `end` | Tab close / navigation away |

Visitor identity is stored in `localStorage` (visitor ID) and `sessionStorage` (session ID) — no cookies used.

---

## API

### Track (public)

```
POST /_emdash/api/plugins/statistics-em/track
```

Accepts tracking payloads from the injected client script. No authentication required.

### Admin

```
POST /_emdash/api/plugins/statistics-em/admin
```

Handles dashboard page loads, tab switches, settings updates. Requires admin authentication.

---

## Internationalization

Full support for **English** and **Arabic** with 200+ translated strings. Locale is detected from:

1. `emdash-locale` cookie
2. `Accept-Language` header
3. Admin configuration fallback

Arabic number and percent formatting is applied automatically.

---

## Admin Widgets

The plugin registers three admin dashboard widgets:

| Widget | Size | Description |
|---|---|---|
| `visit-stats` | Half | Today/yesterday analytics summary |
| `traffic-chart` | Full | 30-day traffic trend |
| `live-counter` | Third | Live active visitor count |

---

## Requirements

- EmDash CMS
- Node.js 18+

---

## License

MIT © [6arshid](https://github.com/6arshid)
