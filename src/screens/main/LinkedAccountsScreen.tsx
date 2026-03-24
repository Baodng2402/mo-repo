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
import axiosClient from '@/api/axiosConfig';
import ENDPOINTS from '@/api/endpoint';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkedAccounts'>;

WebBrowser.maybeCompleteAuthSession();

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

interface TestResult {
  status: TestStatus;
  message: string;
  detail?: string;
}

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
      isLinked
        ? 'border-emerald-500/20 bg-emerald-500/10'
        : 'border-slate-700 bg-slate-800'
    }`}
  >
    <Text
      className={`text-[10px] font-bold uppercase tracking-wider ${
        isLinked ? 'text-emerald-400' : 'text-slate-400'
      }`}
    >
      {isLinked ? 'Linked' : 'Not Linked'}
    </Text>
  </View>
);

const TestResultBanner = ({ result }: { result: TestResult }) => {
  if (result.status === 'idle') return null;

  const isOk = result.status === 'ok';
  const isTesting = result.status === 'testing';

  return (
    <View
      className={`mt-3 rounded-xl p-3 border ${
        isTesting
          ? 'border-slate-600 bg-slate-800/50'
          : isOk
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-red-500/30 bg-red-500/10'
      }`}
    >
      <View className="flex-row items-center gap-2">
        {isTesting ? (
          <ActivityIndicator size="small" color="#94A3B8" />
        ) : (
          <MaterialIcons
            name={isOk ? 'check-circle' : 'error'}
            size={16}
            color={isOk ? '#34D399' : '#F87171'}
          />
        )}
        <Text
          className={`text-xs font-semibold flex-1 ${
            isTesting ? 'text-slate-400' : isOk ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {result.message}
        </Text>
      </View>
      {!!result.detail && (
        <Text className="text-slate-500 text-[10px] mt-1.5 leading-4 font-mono">
          {result.detail}
        </Text>
      )}
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

const LinkedAccountsScreen = ({ navigation }: Props) => {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [isOAuthLoading, setIsOAuthLoading] = useState<'github' | 'jira' | null>(null);
  const [isUnlinking, setIsUnlinking] = useState<'github' | 'jira' | null>(null);
  const [jiraTest, setJiraTest] = useState<TestResult>({ status: 'idle', message: '' });

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

  const handleOAuthSuccess = async (
    url: string,
    provider: 'GITHUB' | 'JIRA',
  ) => {
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
    setJiraTest({ status: 'idle', message: '' });
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
              setJiraTest({ status: 'idle', message: '' });
              showSuccess('Unlinked', `${provider} account removed`);
            } catch (e: any) {
              showError('Error', e?.response?.data?.message || `Failed to unlink ${provider}`);
            } finally {
              setIsUnlinking(null);
            }
          },
        },
      ],
    );
  };

  // ── Test Jira connection ───────────────────────────────────────────────────

  const handleTestJira = async () => {
    setJiraTest({ status: 'testing', message: 'Testing Jira connection...' });
    try {
      const response = await axiosClient.get<any[]>(ENDPOINTS.JIRA.PROJECTS);
      const projects = response.data;

      if (projects.length === 0) {
        setJiraTest({
          status: 'ok',
          message: 'Token valid — but no projects found',
          detail:
            'Your Jira token works, but there are no projects accessible.\n' +
            'Make sure the Jira account has access to at least one project.',
        });
      } else {
        const list = projects
          .slice(0, 5)
          .map((p) => `• ${p.key}  ${p.name}`)
          .join('\n');
        setJiraTest({
          status: 'ok',
          message: `✓ Token valid — ${projects.length} project${projects.length > 1 ? 's' : ''} accessible`,
          detail: list + (projects.length > 5 ? `\n…and ${projects.length - 5} more` : ''),
        });
      }
    } catch (e: any) {
      const data = e?.response?.data;
      const status = e?.response?.status;
      const code = data?.error?.code ?? data?.code ?? 'UNKNOWN';
      const message = data?.error?.message ?? data?.message ?? e?.message ?? 'Request failed';

      const diagMap: Record<number, string> = {
        400: 'Jira account is not linked or token is missing.\n→ Try relinking your Jira account.',
        401: 'Token expired or invalid.\n→ Relink Jira account to get a fresh token.',
        403: 'Token missing required scopes (write:jira-work, read:jira-work).\n→ Relink with the correct permissions.',
        429: 'Jira API rate limit reached. Wait a moment and retry.',
      };

      setJiraTest({
        status: 'fail',
        message: `✗ HTTP ${status ?? '?'} — ${code}`,
        detail: diagMap[status] ?? message,
      });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#101922]">
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-[#324d67]/30 px-4 py-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-white">
          Linked Accounts
        </Text>
        <TouchableOpacity
          onPress={loadAccounts}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <MaterialIcons name="update" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-white">Manage integrations</Text>
        <Text className="mt-1 mb-6 text-sm text-slate-400">
          Connect your GitHub and Jira accounts to sync project activities.
        </Text>

        {loadingAccounts ? (
          <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── GitHub Card ──────────────────────────────────── */}
            <View className="mb-5 rounded-2xl border border-[#324d67] bg-[#1c2630] p-5">
              <View className="flex-row items-center justify-between mb-4">
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
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Feather name="user" size={12} color="#60A5FA" />
                    <Text className="text-blue-300 text-xs font-semibold">
                      {githubAccount.provider_username || githubAccount.provider_email}
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-[10px]">
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
                      className="flex-1 h-10 items-center justify-center rounded-xl bg-slate-700"
                      activeOpacity={0.8}
                    >
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
                      activeOpacity={0.8}
                    >
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
                    className="flex-1 h-11 items-center justify-center rounded-xl bg-[#137fec]"
                    activeOpacity={0.8}
                  >
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
              <View className="flex-row items-center justify-between mb-4">
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
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <MaterialIcons name="account-circle" size={13} color="#60A5FA" />
                    <Text className="text-blue-300 text-xs font-semibold">
                      {jiraAccount.provider_username || jiraAccount.provider_email}
                    </Text>
                  </View>
                  {!!jiraAccount.provider_email && jiraAccount.provider_email !== jiraAccount.provider_username && (
                    <Text className="text-slate-400 text-[11px] mb-1">
                      {jiraAccount.provider_email}
                    </Text>
                  )}
                  <Text className="text-slate-500 text-[10px]">
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
                      className="flex-1 h-10 items-center justify-center rounded-xl bg-[#0052CC]/60"
                      activeOpacity={0.8}
                    >
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
                      activeOpacity={0.8}
                    >
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
                    className="flex-1 h-11 items-center justify-center rounded-xl bg-[#0052CC]"
                    activeOpacity={0.8}
                  >
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
