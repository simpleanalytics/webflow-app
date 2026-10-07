export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function appOrigin(): string {
  return new URL(requiredEnv("APP_BASE_URL")).origin;
}

export function extensionOrigin(): string {
  return new URL(requiredEnv("DESIGNER_EXTENSION_URI")).origin;
}
