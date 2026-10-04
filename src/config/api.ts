export function configuredApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured?.trim()) return configured.trim();
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost';
}
