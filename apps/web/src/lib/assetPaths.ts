const baseUrl = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export function publicAsset(path: string): string {
  return `${baseUrl}${path.replace(/^\/+/, "")}`;
}
