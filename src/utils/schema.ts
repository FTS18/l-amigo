/**
 * Lightweight schema validator for data loaded from external APIs before
 * saving to chrome.storage. Rejects malformed / spoofed API responses silently.
 * No external dependencies — uses plain TypeScript type guards.
 */

import type { FriendProfile } from '../types';

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}
function isOptionalString(v: unknown): v is string | undefined {
  return v === undefined || v === null || typeof v === 'string';
}

/**
 * Validates a FriendProfile object from an external API response.
 * Returns the profile unchanged if valid, or null if it fails validation.
 */
export function validateProfile(raw: unknown): FriendProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;

  // Required fields
  if (!isString(p.username) || p.username.trim().length === 0) return null;
  if (!isOptionalString(p.platform)) return null;

  // Numeric stats — allow missing (undefined) but reject non-numbers if present
  const numericFields = ['totalSolved', 'easySolved', 'mediumSolved', 'hardSolved', 'rating', 'rank'];
  for (const field of numericFields) {
    if (p[field] !== undefined && p[field] !== null && !isNumber(p[field])) {
      return null;
    }
  }

  // recentSubmissions must be an array if present
  if (p.recentSubmissions !== undefined && !Array.isArray(p.recentSubmissions)) {
    return null;
  }

  // Cap array length to prevent storage bloat from a malicious response
  if (Array.isArray(p.recentSubmissions) && p.recentSubmissions.length > 200) {
    p.recentSubmissions = p.recentSubmissions.slice(0, 200);
  }

  // lastFetched must be a number if present
  if (p.lastFetched !== undefined && !isNumber(p.lastFetched)) {
    return null;
  }

  return p as unknown as FriendProfile;
}

/**
 * Validates an array of FriendProfiles and filters out any invalid entries.
 */
export function validateProfiles(raws: unknown[]): FriendProfile[] {
  return raws.map(validateProfile).filter((p): p is FriendProfile => p !== null);
}
