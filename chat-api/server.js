import http from "http";
import OpenAI from "openai";
import { getSystemPrompt } from "./prompt.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL;
const MODEL = process.env.OPENAI_MODEL || "qwen-turbo";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://kilc.co.uk")
  .split(",")
  .map((s) => s.trim());

if (!API_KEY) {
  console.error("OPENAI_API_KEY is required");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: API_KEY,
  ...(BASE_URL && { baseURL: BASE_URL }),
});

// In-memory rate limiting: max 20 requests per IP per minute
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;

  entry.count++;
  return false;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function setCorsHeaders(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  let parsed;
  try {
    const raw = await readBody(req);
    parsed = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const { message, messages, locale } = parsed;

  // Support both single message (string) and multi-turn (array)
  let conversationMessages;

  if (Array.isArray(messages) && messages.length > 0) {
    if (messages.length > 10) {
      return sendJson(res, 400, { error: "Maximum 10 messages allowed" });
    }
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== "string") {
        return sendJson(res, 400, {
          error: "Each message must have role and content",
        });
      }
      if (msg.role !== "user" && msg.role !== "assistant") {
        return sendJson(res, 400, {
          error: 'Message role must be "user" or "assistant"',
        });
      }
      if (msg.content.length > 500) {
        return sendJson(res, 400, {
          error: "Each message must be 500 characters or fewer",
        });
      }
    }
    conversationMessages = messages.map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));
  } else if (
    message &&
    typeof message === "string" &&
    message.trim().length > 0
  ) {
    if (message.length > 500) {
      return sendJson(res, 400, {
        error: "message must be 500 characters or fewer",
      });
    }
    conversationMessages = [{ role: "user", content: message.trim() }];
  } else {
    return sendJson(res, 400, { error: "message or messages is required" });
  }

  const safeLocale = locale === "zh" ? "zh" : "en";

  let answer;
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: getSystemPrompt(safeLocale) },
        ...conversationMessages,
      ],
      max_tokens: 300,
      temperature: 0.7,
    });
    answer = completion.choices[0].message.content;
  } catch (err) {
    console.error("LLM error:", err?.message || err);
    return sendJson(res, 500, {
      error: "Failed to get a response from the assistant",
    });
  }

  sendJson(res, 200, { answer });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  setCorsHeaders(res, origin);

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  // Chat endpoint
  if (req.method === "POST" && req.url === "/api/chat") {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return sendJson(res, 429, {
        error: "Too many requests. Please wait a moment.",
      });
    }
    await handleChat(req, res);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`KILC chat API running on port ${PORT}`);
});
