import path from "path";

/**
 * Returns the absolute path to backend/ regardless of process.cwd().
 * Derived from this file's location: backend/tests/helpers/paths.ts → ../.. = backend/
 */
export function getBackendRoot(): string {
  const __filename = new URL(import.meta.url).pathname;
  const __here = path.dirname(__filename);
  return path.resolve(__here, "../..");
}
