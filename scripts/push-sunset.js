import { buildMessageFromPayloads, fetchForecastPayloads, getRuntimeConfig } from "./message-utils.js";

const config = getRuntimeConfig();

if (config.sendKeys.length === 0) {
  throw new Error(
    "Missing SERVERCHAN_SENDKEYS or SERVERCHAN_SENDKEY. Add one of them to .env or set it as an environment variable."
  );
}

const payloads = await fetchForecastPayloads(config.forecastRequests);
const message = buildMessageFromPayloads(payloads, config);
const { title, desp } = message;

if (config.isDryRun) {
  console.log("DRY_RUN=1, message was not sent.");
  console.log("----- title -----");
  console.log(title);
  console.log("----- desp -----");
  console.log(desp);
  console.log("----- push status -----");
  console.log(
    message.shouldPush
      ? `Will push ${message.eligibleForecasts.length} result(s) to ${config.sendKeys.length} SendKey(s).`
      : message.skipReason
  );
  process.exit(0);
}

if (!message.shouldPush) {
  console.log(`Skipped ServerChan push: ${message.skipReason}`);
  process.exit(0);
}

for (const [index, sendKey] of config.sendKeys.entries()) {
  const pushResult = await sendServerChan(sendKey, { title, desp });
  const pushId = pushResult.data?.pushid;
  console.log(
    `Pushed sunset alert to SendKey ${index + 1}/${config.sendKeys.length}${pushId ? `, pushid: ${pushId}` : ""}.`
  );
}

async function sendServerChan(sendKey, messageBody) {
  const pushUrl = `https://sctapi.ftqq.com/${encodeURIComponent(sendKey)}.send`;
  const pushResponse = await fetch(pushUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: new URLSearchParams(messageBody)
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

  return pushResult;
}
