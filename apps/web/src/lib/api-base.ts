/** One API origin for every active screen, including LAN development. */
export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ??
    `http://${typeof window === "undefined" ? "localhost" : window.location.hostname}:3100`).replace(/\/$/, "");
}
