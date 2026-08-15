export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.json({ status: "ok" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "No API key" });
  }

  try {
    let body;
    if (typeof req.body === "string") {
      body = req.body;
    } else if (req.body) {
      body = JSON.stringify(req.body);
    } else {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString();
    }

    console.log("Body length:", body.length);
    console.log("Calling Anthropic...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: body,
    });

    console.log("Status:", response.status);
    const data = await response.text();
    console.log("Response length:", data.length);
    console.log("Response body:", data.substring(0, 500));

    return res.status(response.status).setHeader("Content-Type", "application/json").send(data);
  } catch (e) {
    console.log("ERROR:", e.message, e.stack);
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
