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
      const cases = await kvGet("cases") || [];
      return res.json(cases);
    }
    if (req.method === "POST") {
      await kvSet("cases", req.body);
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Cases API error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
