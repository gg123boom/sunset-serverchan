import fs from "node:fs";

export const DEFAULT_RISE_URL =
  "https://sunsetbot.top/?query_id=1346966&intend=select_city&query_city=%E9%87%8D%E5%BA%86%E5%B8%82-%E9%87%8D%E5%BA%86&event_date=None&event=rise_2&times=None&model=GFS";
export const DEFAULT_SET_URL =
  "https://sunsetbot.top/?query_id=6781199&intend=select_city&query_city=%E9%87%8D%E5%BA%86%E5%B8%82-%E9%87%8D%E5%BA%86&event_date=None&event=set_2&times=None&model=GFS";
export const DEFAULT_OPEN_URL = "https://sunsetbot.top/map/";
export const PUSH_THRESHOLD = 0.4;

export function loadDotEnv() {
  if (!fs.existsSync(".env")) return;

  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getRuntimeConfig() {
  loadDotEnv();

  const riseUrl = process.env.RISE_URL || process.env.SUNRISE_URL || process.env.SUNSET_URL || DEFAULT_RISE_URL;
  const setUrl = process.env.SET_URL || process.env.SUNSET_EVENT_URL || DEFAULT_SET_URL;

  return {
    sendKey: process.env.SERVERCHAN_SENDKEY,
    sendKeys: parseSendKeys(process.env.SERVERCHAN_SENDKEYS || process.env.SERVERCHAN_SENDKEY || ""),
    riseUrl,
    setUrl,
    sunsetUrl: riseUrl,
    openUrl: process.env.OPEN_URL || DEFAULT_OPEN_URL,
    city: process.env.PUSH_CITY || "\u91cd\u5e86",
    eventName: process.env.PUSH_EVENT || "\u706b\u70e7\u4e91",
    isDryRun: process.env.DRY_RUN === "1",
    dateText: formatNowInShanghai(),
    forecastRequests: [
      { key: "rise", label: "\u65e5\u51fa", url: riseUrl },
      { key: "set", label: "\u65e5\u843d", url: setUrl }
    ]
  };
}

export function parseSendKeys(value) {
  return String(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function fetchForecastPayloads(requests) {
  return Promise.all(
    requests.map(async (request) => {
      const response = await fetch(request.url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
          accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.8"
        }
      });

      if (!response.ok) {
        throw new Error(`SunsetBot ${request.label} request failed: HTTP ${response.status}`);
      }

      return {
        ...request,
        contentType: response.headers.get("content-type") || "",
        rawBody: await response.text()
      };
    })
  );
}

export async function fetchSunsetPayload(sunsetUrl) {
  const [payload] = await fetchForecastPayloads([{ key: "single", label: "\u706b\u70e7\u4e91", url: sunsetUrl }]);
  return payload;
}

export function buildMessageFromPayloads(payloads, options) {
  const forecasts = payloads.map((payload) => formatForecast(payload, options));
  const eligibleForecasts = forecasts.filter((forecast) => forecast.shouldPush);
  const shouldPush = eligibleForecasts.length > 0;

  return {
    title: buildMessageTitle(options),
    shouldPush,
    forecasts,
    eligibleForecasts,
    skipReason: shouldPush ? "" : buildSkipReason(forecasts),
    desp: buildForecastMarkdown(eligibleForecasts, forecasts, options)
  };
}

export function buildMessage(body, type, options) {
  return buildMessageFromPayloads(
    [
      {
        key: "single",
        label: options.eventName || "\u706b\u70e7\u4e91",
        url: options.sunsetUrl || options.riseUrl || DEFAULT_RISE_URL,
        contentType: type,
        rawBody: body
      }
    ],
    options
  );
}

export function buildPreviewHtml(message, options) {
  const bodyHtml = markdownToHtml(message.desp);
  const escapedTitle = escapeHtml(message.title);
  const escapedGeneratedAt = escapeHtml(options.dateText);
  const escapedOpenUrl = escapeHtml(options.openUrl);
  const escapedSourceUrls = escapeHtml(
    options.forecastRequests.map((request) => `${request.label}: ${request.url}`).join("\n")
  );
  const escapedPreviewQuality = options.previewQualityText
    ? escapeHtml(`\u9884\u89c8\u6a21\u5f0f: ${options.previewQualityText}`)
    : "";
  const escapedPushStatus = escapeHtml(
    message.shouldPush
      ? `\u5171 ${message.eligibleForecasts.length} \u6761\u8fbe\u5230 ${PUSH_THRESHOLD} \u9608\u503c, \u771f\u5b9e\u8fd0\u884c\u65f6\u4f1a\u63a8\u9001`
      : message.skipReason
  );

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <style>
    :root {
      color-scheme: light;
      --page: #eef1f4;
      --panel: #ffffff;
      --text: #1d2733;
      --muted: #697889;
      --line: #e5e9ef;
      --accent: #d94c32;
      --accent-soft: #fff1ec;
      --link: #1976a9;
      --shadow: 0 24px 70px rgba(22, 35, 49, 0.14);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--page);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      line-height: 1.55;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(320px, 460px) minmax(320px, 560px);
      gap: 28px;
      align-items: start;
      justify-content: center;
      padding: 34px 20px;
    }

    .phone {
      overflow: hidden;
      border: 1px solid rgba(29, 39, 51, 0.08);
      border-radius: 30px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .phone-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 22px;
      background: #f8f9fb;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }

    .phone-title {
      text-align: center;
      line-height: 1.2;
    }

    .phone-title small {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
    }

    .account {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
    }

    .avatar {
      display: grid;
      width: 46px;
      height: 46px;
      place-items: center;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 800;
    }

    .account-name {
      font-size: 21px;
      font-weight: 750;
    }

    .account-url {
      color: var(--muted);
      font-size: 12px;
    }

    .message-title {
      padding: 18px 20px 0;
      font-size: 18px;
      font-weight: 700;
      color: #202936;
    }

    .message {
      padding: 16px 20px 28px;
    }

    .message table {
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
    }

    .message th,
    .message td {
      padding: 11px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    .message tr:last-child td {
      border-bottom: 0;
    }

    .message th {
      background: #f6f8fa;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }

    .message td {
      font-size: 14px;
      font-weight: 650;
    }

    .message hr {
      height: 1px;
      margin: 22px 0 14px;
      border: 0;
      background: var(--line);
    }

    .message p {
      margin: 7px 0;
      color: var(--muted);
      font-size: 14px;
    }

    .message a {
      color: var(--link);
      font-weight: 700;
      text-decoration: none;
    }

    .debug {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      box-shadow: 0 14px 40px rgba(22, 35, 49, 0.08);
    }

    .debug header {
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
    }

    .debug h1 {
      margin: 0 0 6px;
      font-size: 22px;
    }

    .debug p {
      margin: 0;
      color: var(--muted);
    }

    .debug section {
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
    }

    .debug section:last-child {
      border-bottom: 0;
    }

    .debug h2 {
      margin: 0 0 10px;
      font-size: 15px;
    }

    pre {
      overflow: auto;
      margin: 0;
      padding: 12px;
      border-radius: 8px;
      background: #f6f8fa;
      color: #263340;
      white-space: pre-wrap;
      word-break: break-word;
      font: 13px/1.5 Consolas, "SFMono-Regular", monospace;
    }

    @media (max-width: 860px) {
      .workspace {
        grid-template-columns: minmax(0, 460px);
        padding: 18px 12px;
      }
    }
  </style>
</head>
<body>
  <main class="workspace">
    <article class="phone">
      <div class="phone-bar">
        <span>x</span>
        <div class="phone-title">
          <span>\u6d88\u606f\u8be6\u60c5</span>
          <small>sct.ftqq.com</small>
        </div>
        <span>...</span>
      </div>
      <div class="account">
        <div class="avatar">\u9171</div>
        <div>
          <div class="account-name">Server\u9171</div>
          <div class="account-url">https://sct.ftqq.com</div>
        </div>
      </div>
      <div class="message-title">${escapedTitle}</div>
      <div class="message">${bodyHtml}</div>
    </article>

    <aside class="debug">
      <header>
        <h1>\u672c\u5730\u9884\u89c8</h1>
        <p>\u540c\u65f6\u8bf7\u6c42\u65e5\u51fa\u548c\u65e5\u843d\u63a5\u53e3, \u4e0d\u8c03\u7528 Server\u9171, \u4e0d\u6d88\u8017\u63a8\u9001\u989d\u5ea6\u3002</p>
      </header>
      <section>
        <h2>\u6d88\u606f\u6807\u9898</h2>
        <pre>${escapedTitle}</pre>
      </section>
      <section>
        <h2>Markdown \u539f\u6587</h2>
        <pre>${escapeHtml(message.desp)}</pre>
      </section>
      <section>
        <h2>\u8c03\u8bd5\u4fe1\u606f</h2>
        <pre>\u63a8\u9001\u72b6\u6001: ${escapedPushStatus}
${escapedPreviewQuality ? `${escapedPreviewQuality}\n` : ""}\u751f\u6210\u65f6\u95f4: ${escapedGeneratedAt}
\u67e5\u8be2\u63a5\u53e3:
${escapedSourceUrls}
\u6253\u5f00\u94fe\u63a5: ${escapedOpenUrl}</pre>
      </section>
    </aside>
  </main>
</body>
</html>
`;
}

export function parseQualityScore(value) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function describeQuality(score) {
  if (score === null || Number.isNaN(score)) {
    return "\u672a\u63d0\u4f9b\u53ef\u89e3\u6790\u7684\u7ea7\u522b\u6570\u503c";
  }

  if (score < 0.001) {
    return "\u4e0d\u70e7, \u672a\u8fbe\u5230\u63a8\u9001\u9608\u503c";
  }
  if (score < 0.05) {
    return "\u5fae\u5fae\u70e7, \u6216\u8005\u706b\u70e7\u4e91\u4e91\u51b5\u4e0d\u5178\u578b\u6ca1\u6709\u9884\u62a5\u51fa\u6765";
  }
  if (score < 0.2) {
    return "\u5c0f\u70e7, \u5927\u6c14\u5f88\u901a\u900f\u7684\u60c5\u51b5\u4e0b\u624d\u4f1a\u6bd4\u8f83\u597d\u770b";
  }
  if (score < 0.4) {
    return "\u5c0f\u70e7\u5230\u4e2d\u7b49\u70e7";
  }
  if (score < 0.6) {
    return "\u4e2d\u7b49\u70e7, \u6bd4\u8f83\u503c\u5f97\u770b\u7684\u706b\u70e7\u4e91";
  }
  if (score < 0.8) {
    return "\u4e2d\u7b49\u70e7\u5230\u5927\u70e7\u7a0b\u5ea6\u7684\u706b\u70e7\u4e91";
  }
  if (score < 1.0) {
    return "\u4e0d\u662f\u5f88\u5b8c\u7f8e\u7684\u5927\u70e7\u706b\u70e7\u4e91, \u4f8b\u5982\u4e91\u91cf\u6ca1\u6709\u6700\u9ad8\u3001\u5927\u6c14\u504f\u6c61\u3001\u6301\u7eed\u65f6\u95f4\u504f\u77ed\u3001\u6709\u4f4e\u4e91\u906e\u6321\u7b49";
  }
  if (score < 1.5) {
    return "\u5178\u578b\u7684\u706b\u70e7\u4e91\u5927\u70e7";
  }
  if (score < 2.0) {
    return "\u4f18\u8d28\u5927\u70e7, \u706b\u70e7\u4e91\u8303\u56f4\u5e7f\u3001\u4e91\u91cf\u5927\uff08\u4e0d\u4e00\u5b9a\u6ee1\u4e91\u91cf\uff09\u3001\u989c\u8272\u660e\u4eae\u3001\u6301\u7eed\u65f6\u95f4\u957f, \u4e14\u5927\u6c14\u901a\u900f";
  }
  if (score <= 2.5) {
    return "\u4e16\u7eaa\u5927\u70e7, \u706b\u70e7\u4e91\u8303\u56f4\u5f88\u5e7f\u3001\u63a5\u8fd1\u6ee1\u4e91\u91cf\u3001\u989c\u8272\u660e\u4eae\u9c9c\u8273\u3001\u6301\u7eed\u65f6\u95f4\u957f, \u4e14\u5927\u6c14\u975e\u5e38\u901a\u900f";
  }

  return "\u8d85\u51fa\u5e38\u89c4\u7ea7\u522b\u8303\u56f4, \u5efa\u8bae\u6253\u5f00\u5730\u56fe\u67e5\u770b\u8be6\u60c5";
}

function formatForecast(payload, options) {
  const data = parseJson(payload.rawBody);
  if (!data) {
    const fallbackText = buildFallbackSummary(payload.rawBody, payload.contentType);
    return {
      key: payload.key,
      requestLabel: payload.label,
      url: payload.url,
      cityName: options.city,
      eventName: payload.label,
      eventTime: "\u672a\u63d0\u4f9b",
      qualityText: "\u672a\u63d0\u4f9b",
      qualityScore: null,
      qualityDescription: fallbackText,
      shouldPush: false
    };
  }

  const qualityText = valueOrFallback(data.tb_quality);
  const qualityScore = parseQualityScore(qualityText);

  return {
    key: payload.key,
    requestLabel: payload.label,
    url: payload.url,
    cityName: valueOrFallback(data.display_city_name || options.city),
    eventName: valueOrFallback(data.display_event_name_cn || data.display_event_name_ch || payload.label),
    eventTime: valueOrFallback(data.tb_event_time),
    qualityText,
    qualityScore,
    qualityDescription: describeQuality(qualityScore),
    shouldPush: qualityScore !== null && qualityScore >= PUSH_THRESHOLD
  };
}

function buildForecastMarkdown(eligibleForecasts, allForecasts, options) {
  const lines = [];

  if (eligibleForecasts.length > 0) {
    lines.push(buildMarkdownTableHeader(eligibleForecasts));
    lines.push(buildMarkdownSeparator(eligibleForecasts.length + 1));
    lines.push(buildVerticalTableRow("\u57ce\u5e02\u540d\u79f0", eligibleForecasts.map((forecast) => forecast.cityName)));
    lines.push(buildVerticalTableRow("\u7c7b\u578b", eligibleForecasts.map((forecast) => forecast.eventName)));
    lines.push(buildVerticalTableRow("\u65f6\u95f4", eligibleForecasts.map((forecast) => forecast.eventTime)));
    lines.push(buildVerticalTableRow("\u6570\u503c", eligibleForecasts.map((forecast) => forecast.qualityText)));
    lines.push(buildVerticalTableRow("\u7ea7\u522b", eligibleForecasts.map((forecast) => forecast.qualityDescription)));
  } else {
    lines.push(`\u6682\u65e0\u8fbe\u5230 ${PUSH_THRESHOLD} \u7684\u65e5\u51fa/\u65e5\u843d\u706b\u70e7\u4e91\u7ed3\u679c\u3002`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`\u6570\u636e\u6765\u6e90: SunsetBot  `);
  lines.push(`\u67e5\u8be2\u65f6\u95f4: ${options.dateText}  `);
  lines.push(`[\u6253\u5f00\u539f\u59cb\u9875\u9762](${options.openUrl})`);

  if (eligibleForecasts.length === 0) {
    lines.push("");
    lines.push(`\u672c\u6b21\u5b9e\u9645\u67e5\u8be2: ${summarizeForecasts(allForecasts)}`);
  }

  return lines.join("\n");
}

function buildMarkdownTableHeader(forecasts) {
  const labels = forecasts.map((forecast) => forecast.eventName);
  return buildVerticalTableRow("\u706b\u70e7\u4e91\u4fe1\u606f", labels);
}

function buildMarkdownSeparator(columnCount) {
  return `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
}

function buildVerticalTableRow(label, values) {
  return `| ${[label, ...values].map(escapeMarkdownTable).join(" | ")} |`;
}

function buildSkipReason(forecasts) {
  return `\u65e5\u51fa/\u65e5\u843d\u706b\u70e7\u4e91\u7ea7\u522b\u5747\u4f4e\u4e8e ${PUSH_THRESHOLD}, \u672c\u6b21\u4e0d\u63a8\u9001\u3002${summarizeForecasts(forecasts)}`;
}

function summarizeForecasts(forecasts) {
  return forecasts.map((forecast) => `${forecast.eventName}: ${forecast.qualityText}`).join("; ");
}

function buildMessageTitle(options) {
  return `${options.city}${options.eventName}\u4fe1\u606f`;
}

function markdownToHtml(markdown) {
  const html = [];
  const lines = markdown.split(/\r?\n/);
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`);
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();

    if (!text) {
      flushParagraph();
      continue;
    }

    if (text === "---") {
      flushParagraph();
      html.push("<hr>");
      continue;
    }

    if (text.startsWith("<table")) {
      flushParagraph();
      const tableLines = [];
      while (index < lines.length && !lines[index].trim().startsWith("</table>")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        tableLines.push(lines[index]);
      }
      html.push(tableLines.join("\n"));
      continue;
    }

    if (text.startsWith("|")) {
      flushParagraph();
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      html.push(markdownTableToHtml(tableLines.join("\n")));
      continue;
    }

    paragraph.push(lines[index]);
  }

  flushParagraph();

  return html.join("\n");
}

function markdownTableToHtml(block) {
  const rows = block
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));

  const [header, separator, ...bodyRows] = rows;
  if (!header || !separator) {
    return `<p>${inlineMarkdown(block)}</p>`;
  }

  const head = `<thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;

  return `<table>${head}${body}</table>`;
}

function inlineMarkdown(text) {
  const raw = String(text);
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(raw)) !== null) {
    result += escapeHtml(raw.slice(lastIndex, match.index));
    result += `<a href="${escapeHtml(match[2])}" target="_blank" rel="noreferrer">${escapeHtml(match[1])}</a>`;
    lastIndex = match.index + match[0].length;
  }

  result += escapeHtml(raw.slice(lastIndex));
  return result;
}

function buildFallbackSummary(body, type) {
  const title = pickMatch(body, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    pickMatch(body, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    pickMatch(body, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  const text = htmlToText(body);

  const parts = [];
  if (title) parts.push(`**\u9875\u9762\u6807\u9898:** ${title}`);
  if (description) parts.push(`**\u9875\u9762\u63cf\u8ff0:** ${description}`);
  parts.push(trimLong(text || type || body, 3500));

  return parts.join("\n\n");
}

function parseJson(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function formatNowInShanghai() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function escapeMarkdownTable(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function valueOrFallback(value) {
  if (value === undefined || value === null || value === "") {
    return "\u672a\u63d0\u4f9b";
  }
  return String(value);
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function pickMatch(text, regex) {
  const match = text.match(regex);
  return match ? decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim()) : "";
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function trimLong(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n...\u5185\u5bb9\u8fc7\u957f, \u5df2\u622a\u65ad\u3002`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
