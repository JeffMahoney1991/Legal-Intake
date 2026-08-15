export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  // GET request = diagnostic test
  if (req.method === "GET") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    return new Response(
      JSON.stringify({
        status: "Function is running",
        hasApiKey: !!apiKey,
        keyPrefix: apiKey ? apiKey.slice(0, 10) + "..." : "MISSING",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Proxy failed", message: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
