export const debugLog = (tag: string, payload?: unknown) => {
  if (!__DEV__) return;

  if (typeof payload === 'undefined') {
    console.log(tag);
    return;
  }

  console.log(tag, payload);
};
