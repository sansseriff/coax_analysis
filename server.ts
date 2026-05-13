const DIST = "./dist";
const PORT = Number(process.env.PORT ?? 3000);

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

    const file = Bun.file(DIST + pathname);
    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback
    const index = Bun.file(DIST + "/index.html");
    if (await index.exists()) {
      return new Response(index, { headers: { "Content-Type": "text/html" } });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Serving ${DIST} on http://0.0.0.0:${PORT}`);
