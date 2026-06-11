import { buildMessageFromPayloads, fetchForecastPayloads, getRuntimeConfig } from "./message-utils.js";

const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith("--")) || "both";
const shouldSend = process.env.SEND_SIMULATED === "1" || args.includes("--send");
const config = getRuntimeConfig();

if (!config.sendKey && shouldSend) {
  throw new Error("Missing SERVERCHAN_SENDKEY. Add it to .env or set it as an environment variable.");
}

const simulationModes = {
  both: {
    rise: "0.597\uFF08\u6C61\uFF09",
    set: "0.832\uFF08\u826F\uFF09"
  },
  "set-only": {
    rise: "0.004\uFF08\u5FAE\u70E7\uFF09",
    set: "0.832\uFF08\u826F\uFF09"
  },
  "rise-only": {
    rise: "0.597\uFF08\u6C61\uFF09",
    set: "0.004\uFF08\u5FAE\u70E7\uFF09"
  }
};

const qualities = simulationModes[mode];
if (!qualities) {
  throw new Error(`Unknown simulation mode: ${mode}. Use both, set-only, or rise-only.`);
}

const payloads = await fetchForecastPayloads(config.forecastRequests);
const simulatedPayloads = payloads.map((payload) => ({
  ...payload,
  rawBody: applyQuality(payload.rawBody, qualities[payload.key])
}));
const message = buildMessageFromPayloads(simulatedPayloads, config);

if (!message.shouldPush) {
  throw new Error(`Simulated message did not meet push threshold for mode: ${mode}`);
}

if (!shouldSend) {
  console.log("Simulated message was not sent. Set SEND_SIMULATED=1 to push it.");
  console.log("----- mode -----");
  console.log(mode);
  console.log("----- title -----");
  console.log(message.title);
  console.log("----- desp -----");
  console.log(message.desp);
  process.exit(0);
}

const response = await fetch(`https://sctapi.ftqq.com/${encodeURIComponent(config.sendKey)}.send`, {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
  },
  body: new URLSearchParams({
    title: message.title,
    desp: message.desp
  })
});

const text = await response.text();
if (!response.ok) {
  throw new Error(`ServerChan HTTP ${response.status}: ${text}`);
}

let result;
try {
  result = JSON.parse(text);
} catch {
  result = { raw: text };
}

if (result.code && result.code !== 0) {
  throw new Error(`ServerChan rejected: ${text}`);
}

console.log(`Pushed simulated ${mode} message, pushid=${result.data?.pushid ?? "unknown"}`);

function applyQuality(body, quality) {
  const data = JSON.parse(body);
  data.tb_quality = quality;
  return JSON.stringify(data);
}
