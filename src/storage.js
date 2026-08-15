// localStorage wrapper — replaces Claude's window.storage API
export async function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(`lt_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function save(key, val) {
  try {
    localStorage.setItem(`lt_${key}`, JSON.stringify(val));
  } catch (e) {
    console.error("Storage save error:", e);
  }
}
