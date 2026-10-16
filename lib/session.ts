export const sessionExpiredEvent = "bhumisaara:session-expired";

export function sessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.userId == null ? null : String(user.userId);
  } catch {
    return null;
  }
}

export function clearSessionStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
}

export function expireSession() {
  if (typeof window === "undefined") return;
  clearSessionStorage();
  window.dispatchEvent(new Event(sessionExpiredEvent));
}

export function finishSession(cache: { cancelQueries: () => Promise<unknown>; clear: () => void }, navigateToLogin: () => void) {
  clearSessionStorage();
  void cache.cancelQueries();
  cache.clear();
  navigateToLogin();
}
