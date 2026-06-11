import fs from "node:fs";
import path from "node:path";
import { buildMessageFromPayloads, buildPreviewHtml, fetchForecastPayloads, getRuntimeConfig } from "./message-utils.js";

const config = getRuntimeConfig();
const payloads = await fetchForecastPayloads(config.forecastRequests);
const previewPayloads = payloads.map((payload) => ({
  ...payload,
  rawBody: applyPreviewQuality(payload.rawBody, getPreviewQuality(payload.key))
}));
const previewConfig = {
  ...config,
  previewQualityText: buildPreviewQualityText()
};
const message = buildMessageFromPayloads(previewPayloads, previewConfig);
const html = buildPreviewHtml(message, previewConfig);
const outputPath = path.resolve("preview.html");

fs.writeFileSync(outputPath, html, "utf8");

console.log(`Preview written to ${outputPath}`);
console.log("No ServerChan message was sent.");
console.log(previewConfig.previewQualityText);

function getPreviewQuality(key) {
  if (process.env.PREVIEW_QUALITY) {
    return process.env.PREVIEW_QUALITY;
  }
  if (key === "rise") {
    return process.env.PREVIEW_RISE_QUALITY || "0.597\uFF08\u6C61\uFF09";
  }
  if (key === "set") {
    return process.env.PREVIEW_SET_QUALITY || "0.832\uFF08\u826F\uFF09";
  }
  return "0.597\uFF08\u6C61\uFF09";
}

function buildPreviewQualityText() {
  const riseQuality = getPreviewQuality("rise");
  const setQuality = getPreviewQuality("set");
  return `\u65e5\u51fa tb_quality=${riseQuality}; \u65e5\u843d tb_quality=${setQuality}`;
}

function applyPreviewQuality(body, quality) {
  try {
    const data = JSON.parse(body);
    data.tb_quality = quality;
    return JSON.stringify(data);
  } catch {
    return body;
  }
}
