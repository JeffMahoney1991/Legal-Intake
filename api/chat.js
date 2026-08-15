export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
    if (req.method === "GET") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      return new Response(
        JSON.stringify({ status: "ok", hasKey: !!apiKey }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No API key" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: body,
    });

    const responseText = await response.text();

    return new Response(responseText, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message, stack: e.stack }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
