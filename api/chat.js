export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.json({ ok: true, method: "GET" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "not POST" });
  }

  return res.json({ ok: true, method: "POST", bodyType: typeof req.body });
}
