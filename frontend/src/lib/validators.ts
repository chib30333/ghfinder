
export function isEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function isBlank(value: string): boolean {
  return !value.trim();
}
