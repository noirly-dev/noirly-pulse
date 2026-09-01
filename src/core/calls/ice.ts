export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export function parseIceUrlList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const DEFAULT_TURN_TTL_SECONDS = 14_400;
