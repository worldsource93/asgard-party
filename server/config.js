export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (!env.DATABASE_URL?.startsWith('libsql://') || !env.DATABASE_AUTH_TOKEN?.trim()) {
    throw new Error('Production requires Turso DATABASE_URL (libsql://) and DATABASE_AUTH_TOKEN.');
  }
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
  if (!origins.length || origins.some(value => {
    try {
      const url = new URL(value);
      return url.protocol !== 'https:' || url.origin !== value;
    } catch { return true; }
  })) {
    throw new Error('Production requires ALLOWED_ORIGINS containing exact HTTPS origins without paths.');
  }
}
