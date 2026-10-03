import type { EnvironmentVariable } from "../pages/types";

export type EnvironmentParseResult =
  | { variables: EnvironmentVariable[]; error?: undefined }
  | { variables: null; error: string };

export function parseEnvironmentText(text: string): EnvironmentParseResult {
  const variables: EnvironmentVariable[] = [];
  const keys = new Set<string>();

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const normalized = line.trim();
    if (!normalized || normalized.startsWith("#")) continue;

    const content = normalized.startsWith("export ") ? normalized.slice(7).trim() : normalized;
    const separator = content.indexOf("=");
    if (separator <= 0) {
      return { variables: null, error: `Invalid .env format on line ${index + 1}` };
    }

    const key = content.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { variables: null, error: `Invalid variable name on line ${index + 1}` };
    }
    if (keys.has(key)) {
      return { variables: null, error: `Duplicate variable "${key}"` };
    }

    let value = content.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    keys.add(key);
    variables.push({ key, value });
  }

  if (variables.length === 0) {
    return { variables: null, error: "No valid environment variables found in the pasted file" };
  }

  return { variables };
}
