// Deterministic avatar styling (color + initials) derived from a user's
// email/name, used to show "who else is here" presence indicators.

const ADMIN_EMAIL = "edwin.qm@outlook.com";

const PALETTE = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#db2777", // pink
  "#4f46e5", // indigo
];

export function colorForEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (e === ADMIN_EMAIL) return "var(--blue)";
  let hash = 0;
  for (let i = 0; i < e.length; i++) hash = (hash * 31 + e.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initialsFor(nameOrEmail: string, email?: string): string {
  const e = (email ?? nameOrEmail).trim().toLowerCase();
  if (e === ADMIN_EMAIL) return "GG";

  const name = nameOrEmail.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && !parts[0].includes("@")) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  // Fall back to the email local-part
  const local = (email ?? nameOrEmail).split("@")[0];
  return local.slice(0, 2).toUpperCase();
}
