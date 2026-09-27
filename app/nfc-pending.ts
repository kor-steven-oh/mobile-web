const KEY = 'sdd2026-pending-nfc';
const MAX_AGE = 10 * 60 * 1000;
type PendingNfc = { token: string; slot: number; capturedAt: number };

function linkData(): PendingNfc | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('checkin');
  const slot = params.get('slot') ?? '1';
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !/^[1-5]$/.test(slot)) return null;
  return { token, slot: Number(slot), capturedAt: Date.now() };
}

export function captureNfcLink() {
  const data = linkData();
  if (!data) {
    if (new URLSearchParams(window.location.hash.slice(1)).has('checkin')) clearPendingNfc();
    return;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch { /* Keep the fragment when storage is unavailable. */ }
}

function pendingNfc(): PendingNfc | null {
  // A newly scanned URL always wins over an earlier pending scan.
  const incoming = linkData();
  if (incoming) return incoming;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    const slot = value?.slot ?? 1;
    if (value && /^[a-f0-9]{64}$/.test(value.token) && Number.isInteger(slot) && slot >= 1 && slot <= 5
      && Date.now() - value.capturedAt >= 0 && Date.now() - value.capturedAt < MAX_AGE) return { ...value, slot };
    clearPendingNfc();
  } catch { /* Storage may be disabled. */ }
  return null;
}

export function pendingNfcToken(): string | null { return pendingNfc()?.token ?? null; }
export function pendingNfcSlot(): number { return pendingNfc()?.slot ?? 1; }

export function clearPendingNfc() {
  try { sessionStorage.removeItem(KEY); } catch { /* No persistent token to clear. */ }
  if (new URLSearchParams(window.location.hash.slice(1)).has('checkin')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
