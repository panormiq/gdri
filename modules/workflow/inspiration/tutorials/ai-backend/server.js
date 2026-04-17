const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/medicapp";
const mongoDbName = process.env.MONGO_DB_NAME || "medicapp";
const allowedOrigin = process.env.CORS_ORIGIN || "http://medicapp.local";
const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const allowedOrigins = allowedOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*")) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  }
};

let mongoClient = null;
let generationsCollection = null;

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

async function ensureMongo() {
  if (generationsCollection) return generationsCollection;
  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const db = mongoClient.db(mongoDbName);
    generationsCollection = db.collection("ai_generations");
    return generationsCollection;
  } catch (error) {
    return null;
  }
}

app.post("/api/ollama/generate", async (req, res) => {
  const { prompt, model } = req.body || {};
  if (!prompt || !model) {
    return res.status(400).json({ error: "prompt_and_model_required" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs);
    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        prompt
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({
        error: "ollama_error",
        status: response.status,
        details: text
      });
    }

    const data = await response.json();
    const raw = data.response || "";
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parsed = null;
    }

    const workflow = parsed?.workflow ?? null;
    const blocks = parsed?.blocks ?? null;

    const collection = await ensureMongo();
    if (collection) {
      await collection.insertOne({
        prompt,
        model,
        responseRaw: raw,
        parsed: parsed || null,
        createdAt: new Date()
      });
    }

    return res.json({ raw, workflow, blocks });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Ollama proxy error:", error);
    return res.status(500).json({
      error: "proxy_failed",
      details: error?.message || String(error)
    });
  }
});

app.get("/api/ollama/stream", async (req, res) => {
  const prompt = req.query?.prompt;
  const model = req.query?.model;
  if (!prompt || !model) {
    return res.status(400).json({ error: "prompt_and_model_required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  res.write(": connected\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs);
  let isClosed = false;
  let sentWorkflow = false;
  const sentBlocks = new Set();

  req.on("close", () => {
    isClosed = true;
    clearTimeout(timeout);
    controller.abort();
  });

  const sendEvent = (event, data) => {
    if (isClosed) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const emitBlockIfNew = (block) => {
    if (!block || typeof block !== "object") return;
    if (!block.id) return;
    if (sentBlocks.has(block.id)) return;
    sentBlocks.add(block.id);
    sendEvent("block", block);
  };

  const emitWorkflowIfNew = (workflow) => {
    if (!workflow || typeof workflow !== "object") return;
    if (sentWorkflow) return;
    sentWorkflow = true;
    sendEvent("workflow", workflow);
  };

  try {
    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        prompt
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      sendEvent("error", {
        error: "ollama_error",
        status: response.status,
        details: text
      });
      res.end();
      return;
    }

    if (!response.body) {
      sendEvent("error", { error: "missing_stream_body" });
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let ollamaBuffer = "";
    let modelBuffer = "";
    let responseRaw = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      ollamaBuffer += chunk;

      const lines = ollamaBuffer.split("\n");
      ollamaBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsedLine = null;
        try {
          parsedLine = JSON.parse(trimmed);
        } catch (error) {
          parsedLine = null;
        }
        if (!parsedLine) continue;

        if (typeof parsedLine.response === "string") {
          responseRaw += parsedLine.response;
          modelBuffer += parsedLine.response;

          const modelLines = modelBuffer.split("\n");
          modelBuffer = modelLines.pop() || "";

          for (const modelLine of modelLines) {
            const candidate = modelLine.trim();
            if (!candidate) continue;
            try {
              const obj = JSON.parse(candidate);
              if (obj?.id && obj?.shape) {
                emitBlockIfNew(obj);
              } else if (obj?.shapes && obj?.connections) {
                emitWorkflowIfNew(obj);
              }
            } catch (error) {
              // ignore partial JSON
            }
          }
        }

        if (parsedLine.done) {
          break;
        }
      }
    }

    const finalText = modelBuffer.trim() || responseRaw.trim();
    if (finalText) {
      try {
        const parsed = JSON.parse(finalText);
        if (parsed?.workflow) {
          emitWorkflowIfNew(parsed.workflow);
        }
        if (Array.isArray(parsed?.blocks)) {
          parsed.blocks.forEach(emitBlockIfNew);
        }
      } catch (error) {
        // ignore invalid final JSON
      }
    }

    sendEvent("done", { ok: true });
    res.end();
  } catch (error) {
    if (!isClosed) {
      sendEvent("error", {
        error: "proxy_failed",
        details: error?.message || String(error)
      });
      res.end();
    }
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/api/ollama/health", async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return res.status(502).json({ status: "ollama_error" });
    }
    return res.json({ status: "ok" });
  } catch (error) {
    clearTimeout(timeout);
    return res.status(500).json({ status: "unreachable" });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Ollama proxy listening on ${port}`);
});
