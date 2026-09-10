/**
 * Invite codes carry their context in the code itself: `L-XXXXXX` for a League,
 * `C-XXXXXX` for a Club. Legacy Leagues predate the prefix and keep a bare
 * six-character code, which resolves to a League and never to a Club.
 *
 * Prefixed codes are exactly eight characters and legacy codes exactly six, so a
 * legacy code can never be mistaken for a prefixed one even though the old
 * generator could emit `-` and `_`.
 */

export const INVITE_BODY_LENGTH = 6;
export const INVITE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const LEAGUE_INVITE_PREFIX = "L-";
export const CLUB_INVITE_PREFIX = "C-";
/** Widest value any invite column must accept: prefix plus body. */
export const INVITE_CODE_MAX_LENGTH = 16;

export type InviteContext = "league" | "club";

export type ParsedInviteCode = {
  context: InviteContext;
  /** Full code as stored, e.g. `L-AB12CD` or a legacy `AB12CD`. */
  code: string;
  legacy: boolean;
};

const PREFIXED_BODY = new RegExp(`^[A-Z0-9]{${INVITE_BODY_LENGTH}}$`);
/** The pre-2.0 generator used the nanoid alphabet, so `-` and `_` are possible. */
const LEGACY_CODE = new RegExp(`^[A-Z0-9_-]{${INVITE_BODY_LENGTH}}$`);

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function prefixFor(context: InviteContext): string {
  return context === "league" ? LEAGUE_INVITE_PREFIX : CLUB_INVITE_PREFIX;
}

export function buildInviteCode(context: InviteContext, body: string): string {
  return `${prefixFor(context)}${body.toUpperCase()}`;
}

export function parseInviteCode(raw: string): ParsedInviteCode | null {
  const code = normalizeInviteCode(raw);

  if (code.length === LEAGUE_INVITE_PREFIX.length + INVITE_BODY_LENGTH) {
    const body = code.slice(LEAGUE_INVITE_PREFIX.length);
    if (!PREFIXED_BODY.test(body)) {
      return null;
    }
    if (code.startsWith(LEAGUE_INVITE_PREFIX)) {
      return { context: "league", code, legacy: false };
    }
    if (code.startsWith(CLUB_INVITE_PREFIX)) {
      return { context: "club", code, legacy: false };
    }
    return null;
  }

  return LEGACY_CODE.test(code) ? { context: "league", code, legacy: true } : null;
}

export function isValidInviteCode(raw: string): boolean {
  return parseInviteCode(raw) !== null;
}
