// Storage layer — uses server API for cases/lawyers, localStorage for everything else

export async function load(key, fallback = null) {
  // Cases and lawyers go through the API for cross-device sync
  if (key === "cases" || key === "lawyers") {
    try {
      const res = await fetch(`/api/${key}`);
      if (res.ok) {
        const data = await res.json();
        return data || fallback;
      }
    } catch (e) {
      console.warn(`API fetch failed for ${key}, falling back to localStorage`);
    }
  }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(`lt_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function save(key, val) {
  // Cases and lawyers go through the API
  if (key === "cases" || key === "lawyers") {
    try {
      const res = await fetch(`/api/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(val),
      });
      if (res.ok) return;
    } catch (e) {
      console.warn(`API save failed for ${key}, saving to localStorage`);
    }
  }
  // Fallback to localStorage
  try {
    localStorage.setItem(`lt_${key}`, JSON.stringify(val));
  } catch (e) {
    console.error("Storage save error:", e);
  }
}
