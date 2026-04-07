// ============================================================
// src/utils/validation.ts
// Reusable validators for email domain and password strength
// ============================================================

const ALLOWED_DOMAIN = "primaverse.com";

/**
 * Only accepts addresses ending with @primaverse.com
 */
export function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  const lower = email.trim().toLowerCase();
  if (!lower.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return `Only @${ALLOWED_DOMAIN} email addresses are allowed`;
  }
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(lower)) return "Invalid email format";
  return null; // null = valid
}

/**
 * Password rules:
 *  - At least 6 characters
 *  - At least 1 uppercase letter
 *  - At least 1 number
 *  - At least 1 special symbol
 */
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character";
  return null;
}