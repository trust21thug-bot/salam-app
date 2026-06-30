export async function ensureDb() {
  try {
    const local = await import("./local");
    if (local.tablesHaveData()) return;
    local.loadFromDisk();
  } catch { void 0; }
}
