import { spawn } from "node:child_process";

function frame(obj) {
  const json = Buffer.from(JSON.stringify(obj));
  return Buffer.concat([Buffer.from(`Content-Length: ${json.length}\r\n\r\n`), json]);
}

const child = spawn("node", ["mcp/server.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = Buffer.alloc(0);
const replies = [];

function pull() {
  while (true) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buf.slice(0, headerEnd).toString();
    const m = header.match(/content-length:\s*(\d+)/i);
    if (!m) {
      buf = buf.slice(headerEnd + 4);
      continue;
    }
    const len = Number(m[1]);
    const start = headerEnd + 4;
    if (buf.length < start + len) return;
    replies.push(JSON.parse(buf.slice(start, start + len).toString()));
    buf = buf.slice(start + len);
  }
}

child.stdout.on("data", (c) => {
  buf = Buffer.concat([buf, c]);
  pull();
});

child.stdin.write(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } }));
child.stdin.write(frame({ jsonrpc: "2.0", method: "notifications/initialized" }));
child.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "tools/list" }));

setTimeout(() => {
  child.kill();
  const init = replies.find((r) => r.id === 1);
  const tools = replies.find((r) => r.id === 2);
  console.log("init", init?.result?.serverInfo);
  console.log("tools", tools?.result?.tools?.map((t) => t.name));
  if (!tools?.result?.tools?.some((t) => t.name === "find_ai_addons")) process.exit(1);
}, 800);
