export function safelySetBrowserStorage(
  storage: Pick<Storage, "setItem"> | null | undefined,
  key: string,
  value: string,
) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
