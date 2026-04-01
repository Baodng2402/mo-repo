import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OAUTH_REDIRECT_URI } from '@env';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { Feather, MaterialIcons } from '@/components/icons';
import { showSuccess, showError } from '@/utils/toast';
import { useUserStore } from '@/utils/stores/userStore';
import {
  getGitHubAuthUrl,
  getJiraAuthUrl,
  getLinkedAccounts,
  getProfile,
  unlinkProvider,
  type LinkedAccount,
} from '@/services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkedAccounts'>;

WebBrowser.maybeCompleteAuthSession();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getOAuthRedirectUri = () => {
  const configured = OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return AuthSession.makeRedirectUri({
    scheme: 'jihub',
    path: 'auth/callback',
    native: 'jihub://auth/callback',
  });
};

const formatDate = (date: Date | string) => {
  try {
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(date);
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ isLinked }: { isLinked: boolean }) => (
  <View
    className={`rounded-md border px-2 py-1 ${
      isLinked ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-slate-700 bg-slate-800'
    }`}>
    <Text
      className={`text-[10px] font-bold uppercase tracking-wider ${
        isLinked ? 'text-emerald-400' : 'text-slate-400'
      }`}>
      {isLinked ? 'Linked' : 'Not Linked'}
    </Text>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

const LinkedAccountsScreen = ({ navigation }: Props) => {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [isOAuthLoading, setIsOAuthLoading] = useState<'github' | 'jira' | null>(null);
  const [isUnlinking, setIsUnlinking] = useState<'github' | 'jira' | null>(null);

  const saveUserToStore = useUserStore((state) => state.login);

  const githubAccount = accounts.find((a) => a.provider === 'GITHUB');
  const jiraAccount = accounts.find((a) => a.provider === 'JIRA');

  // ── Load accounts ──────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const data = await getLinkedAccounts();
      setAccounts(data);
    } catch {
      // keep empty
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // ── OAuth connect / relink ─────────────────────────────────────────────────

  const handleOAuthSuccess = async (url: string, provider: 'GITHUB' | 'JIRA') => {
    try {
      const parsedUrl = new URL(url);
      const error = parsedUrl.searchParams.get('error');
      if (error) {
        showError('Error', decodeURIComponent(error));
        return;
      }
      const newToken = parsedUrl.searchParams.get('token');
      if (!newToken) {
        showError('Error', 'No token received from authentication');
        return;
      }
      await AsyncStorage.setItem('access_token', newToken);
      const profile = await getProfile();
      await saveUserToStore({ access_token: newToken, user: profile });
      await loadAccounts();
      showSuccess('Success', `${provider} account linked successfully!`);
    } catch {
      showError('Error', 'Failed to process authentication response');
    }
  };

  const handleConnect = async (provider: 'github' | 'jira') => {
    if (isOAuthLoading) return;
    const redirectUri = getOAuthRedirectUri();
    setIsOAuthLoading(provider);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const getAuthUrl = provider === 'jira' ? getJiraAuthUrl : getGitHubAuthUrl;
      const authUrl = getAuthUrl(token || undefined, redirectUri);

      if (provider === 'jira') {
        await WebBrowser.openBrowserAsync(authUrl);
        await loadAccounts();
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (result.type === 'success' && result.url) {
          await handleOAuthSuccess(result.url, 'GITHUB');
        } else {
          await loadAccounts();
        }
      }
    } catch {
      showError('Error', `Failed to connect ${provider} account`);
    } finally {
      setIsOAuthLoading(null);
    }
  };

  // ── Unlink ─────────────────────────────────────────────────────────────────

  const handleUnlink = (provider: 'GITHUB' | 'JIRA') => {
    Alert.alert(
      `Unlink ${provider === 'GITHUB' ? 'GitHub' : 'Jira'}?`,
      'This will remove the connection. You can relink anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setIsUnlinking(provider.toLowerCase() as 'github' | 'jira');
            try {
              await unlinkProvider(provider);
              await loadAccounts();
              showSuccess('Unlinked', `${provider} account removed`);
            } catch (e: any) {
              showError('Error', e?.response?.data?.message || `Failed to unlink ${provider}`);
            } finally {
              setIsUnlinking(null);
            }
          },
        },
      ]
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#101922]">
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-[#324d67]/30 px-4 py-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-full">
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-white">Linked Accounts</Text>
        <TouchableOpacity
          onPress={loadAccounts}
          className="h-10 w-10 items-center justify-center rounded-full">
          <MaterialIcons name="update" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-white">Manage integrations</Text>
        <Text className="mb-6 mt-1 text-sm text-slate-400">
          Connect your GitHub and Jira accounts to sync project activities.
        </Text>

        {loadingAccounts ? (
          <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── GitHub Card ──────────────────────────────────── */}
            <View className="mb-5 rounded-2xl border border-[#324d67] bg-[#1c2630] p-5">
              <View className="mb-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
                    <Feather name="github" size={28} color="white" />
                  </View>
                  <View>
                    <Text className="text-base font-bold text-white">GitHub</Text>
                    <Text className="text-xs text-slate-400">Source code management</Text>
                  </View>
                </View>
                <StatusBadge isLinked={!!githubAccount} />
              </View>

              {/* Account detail when linked */}
              {!!githubAccount && (
                <View className="mb-3 rounded-xl bg-[#243447] px-3 py-2.5">
                  <View className="mb-1 flex-row items-center gap-1.5">
                    <Feather name="user" size={12} color="#60A5FA" />
                    <Text className="text-xs font-semibold text-blue-300">
                      {githubAccount.provider_username || githubAccount.provider_email}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-slate-500">
                    Linked {formatDate(githubAccount.created_at)}
                  </Text>
                </View>
              )}

              {/* Buttons */}
              <View className="flex-row gap-2">
                {githubAccount ? (
                  <>
                    <TouchableOpacity
                      onPress={() => handleConnect('github')}
                      disabled={isOAuthLoading === 'github'}
                      className="h-10 flex-1 items-center justify-center rounded-xl bg-slate-700"
                      activeOpacity={0.8}>
                      {isOAuthLoading === 'github' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-sm font-bold text-white">Relink</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUnlink('GITHUB')}
                      disabled={isUnlinking === 'github'}
                      className="h-10 w-10 items-center justify-center rounded-xl bg-red-500/15"
                      activeOpacity={0.8}>
                      {isUnlinking === 'github' ? (
                        <ActivityIndicator size="small" color="#F87171" />
                      ) : (
                        <Feather name="trash-2" size={16} color="#F87171" />
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleConnect('github')}
                    disabled={isOAuthLoading === 'github'}
                    className="h-11 flex-1 items-center justify-center rounded-xl bg-[#137fec]"
                    activeOpacity={0.8}>
                    {isOAuthLoading === 'github' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-sm font-bold text-white">Connect GitHub</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Jira Card ────────────────────────────────────── */}
            <View className="mb-5 rounded-2xl border border-[#324d67] bg-[#1c2630] p-5">
              <View className="mb-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#0052CC]">
                    <Feather name="trello" size={28} color="white" />
                  </View>
                  <View>
                    <Text className="text-base font-bold text-white">Jira</Text>
                    <Text className="text-xs text-slate-400">Project tracking</Text>
                  </View>
                </View>
                <StatusBadge isLinked={!!jiraAccount} />
              </View>

              {/* Account detail when linked */}
              {!!jiraAccount && (
                <View className="mb-3 rounded-xl bg-[#243447] px-3 py-2.5">
                  <View className="mb-1 flex-row items-center gap-1.5">
                    <MaterialIcons name="account-circle" size={13} color="#60A5FA" />
                    <Text className="text-xs font-semibold text-blue-300">
                      {jiraAccount.provider_username || jiraAccount.provider_email}
                    </Text>
                  </View>
                  {!!jiraAccount.provider_email &&
                    jiraAccount.provider_email !== jiraAccount.provider_username && (
                      <Text className="mb-1 text-[11px] text-slate-400">
                        {jiraAccount.provider_email}
                      </Text>
                    )}
                  <Text className="text-[10px] text-slate-500">
                    Linked {formatDate(jiraAccount.created_at)}
                  </Text>
                </View>
              )}

              {/* Action buttons */}
              <View className="flex-row gap-2">
                {jiraAccount ? (
                  <>
                    <TouchableOpacity
                      onPress={() => handleConnect('jira')}
                      disabled={isOAuthLoading === 'jira'}
                      className="h-10 flex-1 items-center justify-center rounded-xl bg-[#0052CC]/60"
                      activeOpacity={0.8}>
                      {isOAuthLoading === 'jira' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-sm font-bold text-white">Relink</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUnlink('JIRA')}
                      disabled={isUnlinking === 'jira'}
                      className="h-10 w-10 items-center justify-center rounded-xl bg-red-500/15"
                      activeOpacity={0.8}>
                      {isUnlinking === 'jira' ? (
                        <ActivityIndicator size="small" color="#F87171" />
                      ) : (
                        <Feather name="trash-2" size={16} color="#F87171" />
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleConnect('jira')}
                    disabled={isOAuthLoading === 'jira'}
                    className="h-11 flex-1 items-center justify-center rounded-xl bg-[#0052CC]"
                    activeOpacity={0.8}>
                    {isOAuthLoading === 'jira' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-sm font-bold text-white">Connect Jira</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default LinkedAccountsScreen;
