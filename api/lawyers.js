const kvGet = async (key) => {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
};

const kvSet = async (key, value) => {
  await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(value)),
  });
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const lawyers = await kvGet("lawyers") || [];
      return res.json(lawyers);
    }
    if (req.method === "POST") {
      await kvSet("lawyers", req.body);
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Lawyers API error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
