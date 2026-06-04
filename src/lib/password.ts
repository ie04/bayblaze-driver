import type { PasswordValidation } from "./types";

export function validatePassword(password: string): PasswordValidation {
  return {
    minLength: password.length >= 12,
    lettersAndNumbers: /[a-z]/i.test(password) && /\d/.test(password),
    symbol: /[^a-z0-9]/i.test(password),
  };
}

export function isValidPassword(password: string) {
  return Object.values(validatePassword(password)).every(Boolean);
}
