function normalizeBackendUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^http:\/\/localhost(?=[:/]|$)/i, "http://127.0.0.1");
}

function buildCandidateUrls(backendUrl) {
  const normalized = normalizeBackendUrl(backendUrl).replace(/\/$/, "");
  const candidates = [normalized];

  if (normalized.startsWith("http://127.0.0.1")) {
    candidates.push(normalized.replace("http://127.0.0.1", "http://localhost"));
  }

  return [...new Set(candidates)].filter(Boolean);
}
