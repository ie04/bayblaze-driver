export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailToFirestoreKey(email: string) {
  return normalizeEmail(email).replace(/[/?#[\]]/g, "_");
}
