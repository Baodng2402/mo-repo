import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCESS_TOKEN_KEY = 'access_token';

export const sanitizeAccessToken = (token: string | null | undefined): string | null => {
  if (!token) return null;

  const trimmed = token.trim();
  if (!trimmed) return null;

  return trimmed.startsWith('Bearer ') ? trimmed.slice(7).trim() : trimmed;
};

export const getAccessToken = async (): Promise<string | null> => {
  const rawToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return sanitizeAccessToken(rawToken);
};

export const saveAccessToken = async (token: string): Promise<void> => {
  const normalized = sanitizeAccessToken(token);
  if (!normalized) {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }

  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, normalized);
};

export const clearAccessToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
};
