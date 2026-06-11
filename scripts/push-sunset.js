import { buildMessageFromPayloads, fetchForecastPayloads, getRuntimeConfig } from "./message-utils.js";

const config = getRuntimeConfig();

if (!config.sendKey) {
  throw new Error("Missing SERVERCHAN_SENDKEY. Add it to .env or set it as an environment variable.");
}

const payloads = await fetchForecastPayloads(config.forecastRequests);
const message = buildMessageFromPayloads(payloads, config);
const { title, desp } = message;

const pushUrl = `https://sctapi.ftqq.com/${encodeURIComponent(config.sendKey)}.send`;
const pushBody = new URLSearchParams({
  title,
  desp
});

if (config.isDryRun) {
  console.log("DRY_RUN=1, message was not sent.");
  console.log("----- title -----");
  console.log(title);
  console.log("----- desp -----");
  console.log(desp);
  console.log("----- push status -----");
  console.log(message.shouldPush ? `Will push ${message.eligibleForecasts.length} result(s).` : message.skipReason);
  process.exit(0);
}

if (!message.shouldPush) {
  console.log(`Skipped ServerChan push: ${message.skipReason}`);
  process.exit(0);
}

const pushResponse = await fetch(pushUrl, {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
  },
  body: pushBody
});

const pushResultText = await pushResponse.text();

if (!pushResponse.ok) {
  throw new Error(`ServerChan request failed: HTTP ${pushResponse.status} ${pushResultText}`);
}

let pushResult;
try {
  pushResult = JSON.parse(pushResultText);
} catch {
  pushResult = { raw: pushResultText };
}

if (pushResult.code && pushResult.code !== 0) {
  throw new Error(`ServerChan rejected message: ${pushResultText}`);
}

const pushId = pushResult.data?.pushid;
console.log(`Pushed sunset alert successfully${pushId ? `, pushid: ${pushId}` : ""}.`);
