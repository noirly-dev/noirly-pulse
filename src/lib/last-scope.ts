/** Remembered conversation for "/" (ARCHITECTURE §7.5). */
export const LAST_SCOPE_COOKIE = "pulse-last-scope";
export const LAST_SCOPE_STORAGE_KEY = "pulse:last-scope";

const OBJECT_ID = "[a-f0-9]{24}";
const SCOPE_PATH = new RegExp(
  `^/(?:dm/${OBJECT_ID}|w/${OBJECT_ID}(?:/channel/${OBJECT_ID})?)$`,
);

/** Only same-app conversation paths are ever redirected to. */
export function isLastScopePath(value: string | undefined | null): value is string {
  return typeof value === "string" && SCOPE_PATH.test(value);
}

/** Strip threads/query so "/" lands on the conversation itself. */
export function scopePathFrom(pathname: string): string | null {
  const dm = new RegExp(`^/dm/(${OBJECT_ID})`).exec(pathname);
  if (dm) return `/dm/${dm[1]}`;
  const channel = new RegExp(`^/w/(${OBJECT_ID})/channel/(${OBJECT_ID})`).exec(pathname);
  if (channel) return `/w/${channel[1]}/channel/${channel[2]}`;
  const workspace = new RegExp(`^/w/(${OBJECT_ID})`).exec(pathname);
  if (workspace) return `/w/${workspace[1]}`;
  return null;
}
