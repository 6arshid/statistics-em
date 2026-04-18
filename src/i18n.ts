export type StatisticsLocale = "en" | "ar";

export function normalizeStatisticsLocale(locale?: string | null): StatisticsLocale {
	if (!locale) return "en";
	const normalized = locale.trim().toLowerCase();
	return normalized === "ar" || normalized.startsWith("ar-") ? "ar" : "en";
}

export function resolveStatisticsLocale(
	request: Request | undefined,
	fallbackLocale?: string | null,
): StatisticsLocale {
	const cookieHeader = request?.headers.get("cookie") ?? "";
	const cookieLocale = cookieHeader
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith("emdash-locale="))
		?.slice("emdash-locale=".length);
	if (cookieLocale) return normalizeStatisticsLocale(decodeURIComponent(cookieLocale));

	const acceptLanguage = request?.headers.get("accept-language");
	if (acceptLanguage) {
		const firstLocale = acceptLanguage.split(",")[0]?.trim();
		if (firstLocale) return normalizeStatisticsLocale(firstLocale);
	}

	return normalizeStatisticsLocale(fallbackLocale);
}

const EXACT_ARABIC_TEXT: Record<string, string> = {
	"Analytics Dashboard": "لوحة تحكم التحليلات",
	Refresh: "تحديث",
	Overview: "نظرة عامة",
	"Real-Time": "الوقت الفعلي",
	"Traffic Sources": "مصادر الزيارات",
	"Visitor Insights": "رؤى الزوار",
	Advanced: "متقدم",
	Sessions: "الجلسات",
	Devices: "الأجهزة",
	Content: "المحتوى",
	"SEO / Search": "SEO / البحث",
	"Reports & Charts": "التقارير والرسوم البيانية",
	Settings: "الإعدادات",
	"Live Visitors": "الزوار المباشرون",
	"Active in last 5 min": "نشطون خلال آخر 5 دقائق",
	"Views Today": "مشاهدات اليوم",
	"Sessions Today": "جلسات اليوم",
	"New Today": "الجدد اليوم",
	"30-day summary": "ملخص 30 يومًا",
	"Total Page Views": "إجمالي مشاهدات الصفحة",
	"Total Sessions": "إجمالي الجلسات",
	"New Visitors": "الزوار الجدد",
	"Returning Visitors": "الزوار العائدون",
	"Bounce Rate": "معدل الارتداد",
	"Multi-page Rate": "معدل تعدد الصفحات",
	"Avg. Duration": "متوسط المدة",
	"Per session": "لكل جلسة",
	"Avg. Pages": "متوسط الصفحات",
	"Daily trend — last 30 days": "الاتجاه اليومي — آخر 30 يومًا",
	"Page Views": "مشاهدات الصفحة",
	Date: "التاريخ",
	Count: "العدد",
	"New vs Returning — 30 days": "الجدد مقابل العائدين — 30 يومًا",
	"Online Users Now": "المستخدمون المتصلون الآن",
	"Last 5 min": "آخر 5 دقائق",
	"Current Active Pages": "الصفحات النشطة حاليًا",
	"Current Referrers": "المُحيلون الحاليون",
	"Live Countries": "الدول المباشرة",
	"No live visitors right now": "لا يوجد زوار مباشرون الآن",
	"Current active pages": "الصفحات النشطة حاليًا",
	"No active pages right now": "لا توجد صفحات نشطة الآن",
	"Current referrers": "المُحيلون الحاليون",
	"No active referrers right now": "لا يوجد مُحيلون نشطون الآن",
	"Recent visitor feed": "آخر نشاط الزوار",
	"Last Seen": "آخر ظهور",
	Location: "الموقع",
	Page: "الصفحة",
	Source: "المصدر",
	"No recent visitors yet": "لا يوجد زوار حديثون بعد",
	"Live traffic map": "خريطة الزيارات المباشرة",
	"Live traffic map needs country/city metadata from the request. In local dev this usually stays empty unless your runtime provides geo headers.":
		"تحتاج خريطة الزيارات المباشرة إلى بيانات الدولة/المدينة من الطلب. في التطوير المحلي تبقى عادة فارغة ما لم توفّر بيئتك ترويسات جغرافية.",
	"Today's traffic breakdown": "تفصيل زيارات اليوم",
	Direct: "مباشر",
	Search: "بحث",
	Social: "اجتماعي",
	Referral: "إحالة",
	Paid: "مدفوع",
	"Top referral websites — 30 days": "أهم مواقع الإحالة — 30 يومًا",
	Domain: "النطاق",
	"UTM campaigns — 30 days": "حملات UTM — 30 يومًا",
	Campaign: "الحملة",
	Medium: "الوسيط",
	"No referrals yet": "لا توجد إحالات بعد",
	"No campaigns": "لا توجد حملات",
	"No geo data available": "لا توجد بيانات جغرافية متاحة",
	"Top countries — 30 days": "أهم الدول — 30 يومًا",
	Country: "الدولة",
	"Top cities — 30 days": "أهم المدن — 30 يومًا",
	City: "المدينة",
	"Browser languages — 30 days": "لغات المتصفح — 30 يومًا",
	Language: "اللغة",
	"No language data": "لا توجد بيانات لغات",
	"Time zones — 30 days": "المناطق الزمنية — 30 يومًا",
	Timezone: "المنطقة الزمنية",
	"No timezone data": "لا توجد بيانات مناطق زمنية",
	"No advanced analytics data yet": "لا توجد بيانات تحليلات متقدمة بعد",
	"Enable them from the Settings tab to start collecting advanced analytics data.":
		"فعّلها من تبويب الإعدادات لبدء جمع بيانات التحليلات المتقدمة.",
	"Heatmap activity by page": "نشاط الخريطة الحرارية حسب الصفحة",
	"Top zone": "أكثر منطقة نشاطًا",
	Clicks: "النقرات",
	"No clicks yet": "لا توجد نقرات بعد",
	"No heatmap clicks yet": "لا توجد نقرات خريطة حرارية بعد",
	"Scroll depth by page": "عمق التمرير حسب الصفحة",
	"Tracked Views": "المشاهدات المتتبعة",
	"Avg Depth": "متوسط العمق",
	"Max Depth": "أقصى عمق",
	"No scroll depth data yet": "لا توجد بيانات عمق تمرير بعد",
	"Recent session recordings": "آخر تسجيلات الجلسات",
	Session: "الجلسة",
	Events: "الأحداث",
	Updated: "آخر تحديث",
	"No session recordings yet": "لا توجد تسجيلات جلسات بعد",
	"Funnel conversion": "تحويل القمع",
	Conversion: "التحويل",
	"No funnel data yet": "لا توجد بيانات قمع بعد",
	"A/B experiments": "تجارب A/B",
	Conversions: "التحويلات",
	"Conversion Rate": "معدل التحويل",
	"No experiment data yet": "لا توجد بيانات تجارب بعد",
	"Weekly cohort retention": "الاحتفاظ الأسبوعي حسب الدفعات",
	"Cohort Week": "أسبوع الدفعة",
	Visitors: "الزوار",
	W1: "الأسبوع 1",
	W2: "الأسبوع 2",
	W3: "الأسبوع 3",
	W4: "الأسبوع 4",
	"No cohort data yet": "لا توجد بيانات دفعات بعد",
	"No session data yet": "لا توجد بيانات جلسات بعد",
	"Sessions are recorded as visitors browse your site. Data will appear here once traffic is tracked.":
		"تُسجَّل الجلسات أثناء تصفح الزوار لموقعك. ستظهر البيانات هنا بمجرد بدء تتبع الزيارات.",
	Bounced: "المرتدون",
	"Multi-page": "متعدد الصفحات",
	"Engagement metrics": "مقاييس التفاعل",
	"Session duration distribution": "توزيع مدة الجلسة",
	"New vs returning sessions": "الجلسات الجديدة مقابل العائدة",
	"New Visitor Sessions": "جلسات الزوار الجدد",
	"Returning Visitor Sessions": "جلسات الزوار العائدين",
	"No device data yet": "لا توجد بيانات أجهزة بعد",
	"Device information is collected from new sessions. Data will appear here once visitors browse your site.":
		"تُجمع معلومات الأجهزة من الجلسات الجديدة. ستظهر البيانات هنا بمجرد أن يبدأ الزوار بالتصفح.",
	"Device type breakdown — 30 days": "تفصيل أنواع الأجهزة — 30 يومًا",
	Desktop: "سطح المكتب",
	Mobile: "الجوال",
	Tablet: "الجهاز اللوحي",
	Unknown: "غير معروف",
	"Browser detection — 30 days": "اكتشاف المتصفح — 30 يومًا",
	Browser: "المتصفح",
	Share: "النسبة",
	"No browser data": "لا توجد بيانات متصفح",
	"Operating system — 30 days": "نظام التشغيل — 30 يومًا",
	"Operating System": "نظام التشغيل",
	"No OS data": "لا توجد بيانات نظام تشغيل",
	"Device brands - 30 days": "ماركات الأجهزة — 30 يومًا",
	Brand: "العلامة التجارية",
	"No brand data": "لا توجد بيانات علامات تجارية",
	"Device models - 30 days": "طرازات الأجهزة — 30 يومًا",
	"Brand / Model": "العلامة / الطراز",
	"No device model data": "لا توجد بيانات طرازات أجهزة",
	"Screen resolutions — 30 days": "دقات الشاشة — 30 يومًا",
	Resolution: "الدقة",
	"No resolution data": "لا توجد بيانات دقة",
	"No content data yet": "لا توجد بيانات محتوى بعد",
	"Tracked URLs": "عناوين URL المتتبعة",
	"Top posts — 30 days": "أهم المقالات — 30 يومًا",
	"Top pages — 30 days": "أهم الصفحات — 30 يومًا",
	URL: "الرابط",
	Post: "مقال",
	Posts: "مقالات",
	Pages: "صفحات",
	Entries: "الدخولات",
	Exits: "الخروج",
	"Sessions Started": "الجلسات التي بدأت",
	"Sessions Ended": "الجلسات التي انتهت",
	"No post data": "لا توجد بيانات مقالات",
	"No page data": "لا توجد بيانات صفحات",
	"No entry page data": "لا توجد بيانات صفحات دخول",
	"No exit page data": "لا توجد بيانات صفحات خروج",
	"Top categories — 30 days (from article:section meta)":
		"أهم التصنيفات — 30 يومًا (من article:section)",
	"Top tags — 30 days (from article:tag meta)": "أهم الوسوم — 30 يومًا (من article:tag)",
	Category: "التصنيف",
	Tag: "الوسم",
	Author: "المؤلف",
	"No category data": "لا توجد بيانات تصنيفات",
	"No tag data": "لا توجد بيانات وسوم",
	"No author data": "لا توجد بيانات مؤلفين",
	"Search Console integration": "تكامل Search Console",
	"Enable Search Console": "تفعيل Search Console",
	"Property URL or sc-domain": "رابط الخاصية أو sc-domain",
	"Access Token": "رمز الوصول",
	"OAuth Client ID": "معرّف عميل OAuth",
	"OAuth Client Secret": "سر عميل OAuth",
	"Refresh Token": "رمز التحديث",
	"Save SEO Settings": "حفظ إعدادات SEO",
	"Refresh Search Console": "تحديث Search Console",
	"Search Console is not configured": "لم يتم إعداد Search Console",
	"Enable the integration, add your property, and provide either an access token or refresh-token OAuth credentials.":
		"فعّل التكامل، وأضف الخاصية، وقدّم إما رمز وصول أو بيانات اعتماد OAuth لرمز التحديث.",
	"Search Console sync warning": "تحذير مزامنة Search Console",
	Impressions: "مرات الظهور",
	CTR: "معدل النقر",
	"Last 28 days": "آخر 28 يومًا",
	"Avg. Position": "متوسط الترتيب",
	"Google Search": "بحث Google",
	"Top search keywords - 28 days": "أهم كلمات البحث - 28 يومًا",
	Keyword: "الكلمة المفتاحية",
	Position: "الترتيب",
	"No keyword data yet": "لا توجد بيانات كلمات مفتاحية بعد",
	"Indexed pages overview": "نظرة عامة على الصفحات المفهرسة",
	"Indexed Pages": "الصفحات المفهرسة",
	"Submitted Pages": "الصفحات المرسلة",
	Sitemaps: "خرائط الموقع",
	"Last Sync": "آخر مزامنة",
	Never: "أبدًا",
	Sitemap: "خريطة الموقع",
	Submitted: "تم الإرسال",
	"Last Submitted": "آخر إرسال",
	"No sitemap data yet": "لا توجد بيانات خرائط موقع بعد",
	"Last 30 Days (Daily)": "آخر 30 يومًا (يوميًا)",
	"Last 12 Weeks": "آخر 12 أسبوعًا",
	"Last 12 Months": "آخر 12 شهرًا",
	"Last 2 Years": "آخر سنتين",
	"Custom Range": "نطاق مخصص",
	Daily: "يومي",
	Weekly: "أسبوعي",
	Monthly: "شهري",
	Yearly: "سنوي",
	Custom: "مخصص",
	From: "من",
	To: "إلى",
	"Load Report": "تحميل التقرير",
	"Total Views": "إجمالي المشاهدات",
	Returning: "العائدون",
	"Data table": "جدول البيانات",
	Period: "الفترة",
	"No data for this period": "لا توجد بيانات لهذه الفترة",
	Export: "تصدير",
	"Export CSV": "تصدير CSV",
	"Email Report Now": "إرسال التقرير بالبريد الآن",
	"Scheduled email reports": "تقارير البريد المجدولة",
	"Enable scheduled email reports": "تفعيل تقارير البريد المجدولة",
	"Recipient email": "بريد المستلم",
	Schedule: "الجدولة",
	"Daily (8 AM)": "يوميًا (8 صباحًا)",
	"Weekly (Monday 8 AM)": "أسبوعيًا (الاثنين 8 صباحًا)",
	"Monthly (1st, 8 AM)": "شهريًا (اليوم الأول، 8 صباحًا)",
	"Save Email Settings": "حفظ إعدادات البريد",
	"Dashboard & Multi-Site Settings": "إعدادات لوحة التحكم وتعدد المواقع",
	"Dark Mode Dashboard": "لوحة تحكم داكنة",
	"Apply dark theme to all charts and graphs": "تطبيق النمط الداكن على كل الرسوم البيانية",
	"Site Label": "اسم الموقع",
	"My Site": "موقعي",
	"Label shown in reports and email alerts — useful when running multiple EmDash instances":
		"الاسم الذي يظهر في التقارير وتنبيهات البريد — مفيد عند تشغيل عدة نسخ من EmDash",
	"Default Report Period": "الفترة الافتراضية للتقرير",
	"Daily (last 30 days)": "يومي (آخر 30 يومًا)",
	"Weekly (last 12 weeks)": "أسبوعي (آخر 12 أسبوعًا)",
	"Monthly (last 12 months)": "شهري (آخر 12 شهرًا)",
	"Save Dashboard Settings": "حفظ إعدادات لوحة التحكم",
	"Role-Based Access Control": "التحكم بالوصول حسب الدور",
	"Minimum Role to View Analytics": "أقل دور مطلوب لعرض التحليلات",
	"Users must have at least this role to access the analytics dashboard. Role levels: Subscriber=10, Contributor=20, Author=30, Editor=40, Admin=50.":
		"يجب أن يمتلك المستخدم هذا الدور على الأقل للوصول إلى لوحة التحليلات. مستويات الأدوار: Subscriber=10 و Contributor=20 و Author=30 و Editor=40 و Admin=50.",
	"Save Access Settings": "حفظ إعدادات الوصول",
	"Total Users": "إجمالي المستخدمين",
	"Have Access": "لديهم وصول",
	"Min Role": "الحد الأدنى للدور",
	User: "المستخدم",
	Email: "البريد الإلكتروني",
	Role: "الدور",
	Access: "الوصول",
	"(no name)": "(بدون اسم)",
	Allowed: "مسموح",
	Restricted: "مقيّد",
	"No users found": "لم يتم العثور على مستخدمين",
	"Notification Alerts": "تنبيهات الإشعارات",
	"Daily Views Alert": "تنبيه المشاهدات اليومية",
	"Send an email when daily page views exceed the threshold":
		"أرسل بريدًا عندما تتجاوز مشاهدات الصفحة اليومية الحد المحدد",
	"Views Alert Threshold": "حد تنبيه المشاهدات",
	"Notify when daily views reach this number": "أبلغ عند وصول المشاهدات اليومية إلى هذا الرقم",
	"Views Alert Email": "بريد تنبيه المشاهدات",
	"Bounce Rate Alert": "تنبيه معدل الارتداد",
	"Send an email when 30-day bounce rate exceeds the threshold":
		"أرسل بريدًا عندما يتجاوز معدل الارتداد خلال 30 يومًا الحد المحدد",
	"Bounce Rate Threshold (%)": "حد معدل الارتداد (%)",
	"Alert when bounce rate reaches this percentage": "أبلغ عندما يصل معدل الارتداد إلى هذه النسبة",
	"Bounce Alert Email": "بريد تنبيه الارتداد",
	"New Daily Record Alert": "تنبيه رقم يومي جديد",
	"Send an email when today sets a new all-time daily views record":
		"أرسل بريدًا عندما يسجل اليوم رقمًا قياسيًا جديدًا لمشاهدات اليوم",
	"New Record Email": "بريد الرقم القياسي الجديد",
	"Save Alert Settings": "حفظ إعدادات التنبيهات",
	"Advanced Analytics Features": "ميزات التحليلات المتقدمة",
	"Heatmap Tracking": "تتبع الخريطة الحرارية",
	"Aggregate click zones per page across the last 30 days":
		"تجميع مناطق النقر لكل صفحة خلال آخر 30 يومًا",
	"Scroll Tracking": "تتبع التمرير",
	"Store max scroll depth and page-level scroll distribution":
		"تخزين أقصى عمق تمرير وتوزيع التمرير على مستوى الصفحة",
	"Session Recording": "تسجيل الجلسات",
	"Capture a privacy-safe event timeline of clicks, scrolls, and navigation":
		"التقاط تسلسل زمني آمن للخصوصية للنقرات والتمرير والتنقل",
	"Funnel Analytics": "تحليلات القمع",
	"Measure step-by-step conversion using ordered page paths":
		"قياس التحويل خطوة بخطوة باستخدام مسارات الصفحات المرتبة",
	"Funnel Steps": "خطوات القمع",
	"Comma-separated paths in order of the desired funnel":
		"مسارات مفصولة بفواصل حسب ترتيب القمع المطلوب",
	"A/B Testing": "اختبارات A/B",
	"Assign stable variants and measure conversions by goal path":
		"تعيين متغيرات ثابتة وقياس التحويلات بحسب مسار الهدف",
	"Experiment Rules": "قواعد التجارب",
	"Separate multiple rules with ; using experiment@pathPrefix->goalPath:variantA,variantB":
		"افصل القواعد المتعددة بـ ; باستخدام experiment@pathPrefix->goalPath:variantA,variantB",
	"Cohort Analysis": "تحليل الدفعات",
	"Track weekly retention for newly acquired visitors": "تتبع الاحتفاظ الأسبوعي للزوار الجدد",
	"Save Advanced Settings": "حفظ الإعدادات المتقدمة",
	"Subscriber (10)": "مشترك (10)",
	"Contributor (20)": "مساهم (20)",
	"Author (30)": "كاتب (30)",
	"Editor (40)": "محرر (40)",
	"Admin only (50)": "المدير فقط (50)",
	"Live Now": "الزوار الآن",
	Yesterday: "الأمس",
	"Traffic sources — today": "مصادر الزيارات — اليوم",
	"Device types — 30 days": "أنواع الأجهزة — 30 يومًا",
	"Total Views (30d)": "إجمالي المشاهدات (30 يومًا)",
	"Total Sessions (30d)": "إجمالي الجلسات (30 يومًا)",
	"Active last 5 min": "نشطون خلال آخر 5 دقائق",
	"Live visitors by country": "الزوار المباشرون حسب الدولة",
	"Dashboard settings saved": "تم حفظ إعدادات لوحة التحكم",
	"Access settings saved": "تم حفظ إعدادات الوصول",
	"Alert settings saved": "تم حفظ إعدادات التنبيهات",
	"Advanced analytics settings saved": "تم حفظ إعدادات التحليلات المتقدمة",
	"SEO settings saved": "تم حفظ إعدادات SEO",
	"Search Console refreshed": "تم تحديث Search Console",
	"Enable email reports and set a recipient first": "فعّل تقارير البريد وحدد مستلمًا أولًا",
	"Email report settings saved": "تم حفظ إعدادات تقرير البريد",
	"CSV Export": "تصدير CSV",
	"Copy the data below and save as a .csv file to open in Excel or Google Sheets.":
		"انسخ البيانات التالية واحفظها كملف ‎.csv‎ لفتحها في Excel أو Google Sheets.",
	"Back to Reports": "العودة إلى التقارير",
	"Traffic Alert": "تنبيه الزيارات",
	"Traffic Alert — ": "تنبيه الزيارات — ",
	"New Record!": "رقم قياسي جديد!",
	"Sent by EmDash Statistics": "مرسل بواسطة EmDash Statistics",
	"Sent by EmDash Statistics plugin": "مرسل بواسطة إضافة EmDash Statistics",
	"Analytics Report": "تقرير التحليلات",
};

const EXACT_ARABIC_ENTRIES = Object.entries(EXACT_ARABIC_TEXT);

const WHOLE_TEXT_ARABIC_REPLACEMENTS: Array<[RegExp, string]> = [
	[/^Report sent to (.+)$/u, "تم إرسال التقرير إلى $1"],
	[/^Reports — (.+)$/u, "التقارير — $1"],
	[/^Trend — (.+)$/u, "الاتجاه — $1"],
	[/^Analyzing (.+) sessions from the last 30 days$/u, "جارٍ تحليل $1 جلسة من آخر 30 يومًا"],
	[/^(.+)% of sessions were single-page$/u, "$1٪ من الجلسات كانت من صفحة واحدة"],
	[/^(.+)% of sessions viewed 2\+ pages$/u, "$1٪ من الجلسات شاهدت صفحتين أو أكثر"],
	[/^(.+)% bounce rate$/u, "معدل ارتداد $1٪"],
	[/^(.+)% explored$/u, "$1٪ استكشفوا أكثر من صفحة"],
	[/^(.+) sessions$/u, "$1 جلسة"],
	[/^(.+) views$/u, "$1 مشاهدة"],
	[/^Total Sessions: (.+)$/u, "إجمالي الجلسات: $1"],
	[/^Today's page views: (.+)$/u, "مشاهدات الصفحة اليوم: $1"],
	[/^Current bounce rate \(30-day\): (.+)$/u, "معدل الارتداد الحالي (30 يومًا): $1"],
	[/^Analytics Report — (.+)$/u, "تقرير التحليلات — $1"],
];

const INLINE_ARABIC_REPLACEMENTS: Array<[RegExp, string]> = [
	[/Report sent to (.+)/gu, "تم إرسال التقرير إلى $1"],
	[/Reports — (.+)/gu, "التقارير — $1"],
	[/Trend — (.+)/gu, "الاتجاه — $1"],
	[/Analyzing (.+) sessions from the last 30 days/gu, "جارٍ تحليل $1 جلسة من آخر 30 يومًا"],
	[/([0-9.,]+)% of sessions were single-page/gu, "$1٪ من الجلسات كانت من صفحة واحدة"],
	[/([0-9.,]+)% of sessions viewed 2\+ pages/gu, "$1٪ من الجلسات شاهدت صفحتين أو أكثر"],
	[/([0-9.,]+)% bounce rate/gu, "معدل ارتداد $1٪"],
	[/([0-9.,]+)% explored/gu, "$1٪ استكشفوا أكثر من صفحة"],
	[/([0-9.,]+) sessions/gu, "$1 جلسة"],
	[/([0-9.,]+) views/gu, "$1 مشاهدة"],
	[/Total Sessions: ([0-9.,]+)/gu, "إجمالي الجلسات: $1"],
	[/Today's page views: ([0-9.,]+)/gu, "مشاهدات الصفحة اليوم: $1"],
	[/Current bounce rate \(30-day\): ([0-9.,]+%)/gu, "معدل الارتداد الحالي (30 يومًا): $1"],
];

function replaceDynamicArabic(text: string): string {
	for (const [pattern, replacement] of WHOLE_TEXT_ARABIC_REPLACEMENTS) {
		if (pattern.test(text)) return text.replace(pattern, replacement);
	}

	let output = text;
	for (const [source, target] of EXACT_ARABIC_ENTRIES) {
		output = output.replaceAll(source, target);
	}

	for (const [pattern, replacement] of INLINE_ARABIC_REPLACEMENTS) {
		output = output.replace(pattern, replacement);
	}

	return output;
}

export function translateStatisticsText(locale: StatisticsLocale, text: string): string {
	if (locale !== "ar") return text;

	if (text in EXACT_ARABIC_TEXT) return EXACT_ARABIC_TEXT[text]!;
	return replaceDynamicArabic(text);
}

export function localizeStatisticsValue<T>(locale: StatisticsLocale, value: T): T {
	if (locale !== "ar") return value;
	if (typeof value === "string") return translateStatisticsText(locale, value) as T;
	if (Array.isArray(value)) return value.map((item) => localizeStatisticsValue(locale, item)) as T;
	if (!value || typeof value !== "object") return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [key, localizeStatisticsValue(locale, entry)]),
	) as T;
}
