export function shouldBlockAuthPresentation(isInitialAccountLoad: boolean) {
  return isInitialAccountLoad;
}

export function visiblePrivateData<T>(isAuthenticated: boolean, value: T[] | undefined) {
  return isAuthenticated ? value ?? [] : [];
}
