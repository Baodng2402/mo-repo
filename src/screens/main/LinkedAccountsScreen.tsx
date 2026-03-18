import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { Feather, MaterialIcons } from '@/components/icons';
import { showSuccess, showError } from '@/utils/toast';
import { useUserStore } from '@/utils/stores/userStore';
import {
  getGitHubAuthUrl,
  getJiraAuthUrl,
  getLinkedAccounts,
  getProfile,
} from '@/services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkedAccounts'>;

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_CONFIG = {
  scheme: 'jihub',
  path: 'auth/callback',
} as const;

interface AccountCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isLinked: boolean;
  onConnect: () => void;
  buttonColor?: string;
}

const StatusBadge = ({ isLinked }: { isLinked: boolean }) => (
  <View
    className={`rounded-md border px-2 py-1 ${
      isLinked ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-slate-700 bg-slate-800'
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

const AccountCard = ({
  title,
  subtitle,
  icon,
  isLinked,
  onConnect,
  buttonColor = '#137fec',
}: AccountCardProps) => (
  <View className="mb-6 rounded-2xl border border-[#324d67] bg-[#1c2630] p-5">
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        {icon}
        <View>
          <Text className="text-base font-bold text-white">{title}</Text>
          <Text className="text-xs text-slate-400">{subtitle}</Text>
        </View>
      </View>
      <StatusBadge isLinked={isLinked} />
    </View>

    <TouchableOpacity
      onPress={onConnect}
      disabled={isLinked}
      className={`h-11 items-center justify-center rounded-xl ${
        isLinked ? 'border border-emerald-500/30 bg-emerald-500/20' : ''
      }`}
      style={!isLinked ? { backgroundColor: buttonColor } : undefined}
      activeOpacity={0.8}
    >
      <Text className={`text-sm font-bold ${isLinked ? 'text-emerald-400' : 'text-white'}`}>
        {isLinked ? '✓ Connected' : `Connect ${title}`}
      </Text>
    </TouchableOpacity>
  </View>
);

const LinkedAccountsScreen = ({ navigation }: Props) => {
  const [githubLinked, setGithubLinked] = useState(false);
  const [jiraLinked, setJiraLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const saveUserToStore = useUserStore((state) => state.login);

  useEffect(() => {
    const loadLinkedAccounts = async () => {
      try {
        const linkedAccounts = await getLinkedAccounts();
        setGithubLinked(linkedAccounts.some((acc) => acc.provider === 'GITHUB'));
        setJiraLinked(linkedAccounts.some((acc) => acc.provider === 'JIRA'));
      } catch {
        // Keep default false state if API is unavailable.
      }
    };

    loadLinkedAccounts();
  }, []);

  const handleOAuthSuccess = async (
    url: string,
    provider: string,
    setLinked: (value: boolean) => void,
  ) => {
    try {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        showError('Error', 'Invalid callback URL received');
        return;
      }

      const newToken = parsedUrl.searchParams.get('token');
      const error = parsedUrl.searchParams.get('error');

      if (error) {
        showError('Error', decodeURIComponent(error));
        return;
      }

      if (!newToken) {
        showError('Error', 'No token received from authentication');
        return;
      }

      await AsyncStorage.setItem('access_token', newToken);

      const profile = await getProfile();
      await saveUserToStore({
        access_token: newToken,
        user: profile,
      });

      setLinked(true);
      showSuccess('Success', `${provider} account linked successfully!`);
    } catch {
      showError('Error', 'Failed to process authentication response');
    }
  };

  const handleOAuthConnect = async (
    provider: 'github' | 'jira',
    getAuthUrl: (token?: string, redirectUri?: string) => string,
    setLinked: (value: boolean) => void,
  ) => {
    if (isLoading) return;

    const redirectUri = AuthSession.makeRedirectUri(REDIRECT_CONFIG);

    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      const authUrl = getAuthUrl(token || undefined, redirectUri);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        await handleOAuthSuccess(result.url, provider, setLinked);
      }
    } catch {
      showError('Error', `Failed to connect ${provider} account`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#101922]">
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="flex-row items-center justify-between border-b border-[#324d67]/30 px-4 py-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-white/5"
        >
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>

        <Text className="flex-1 text-center text-lg font-bold text-white">Linked Accounts</Text>

        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-white">Manage integrations</Text>
        <Text className="mt-1 mb-6 text-sm text-slate-400">
          Connect your GitHub and Jira accounts to sync project activities.
        </Text>

        <AccountCard
          title="GitHub"
          subtitle="Source code management"
          icon={
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
              <Feather name="github" size={28} color="white" />
            </View>
          }
          isLinked={githubLinked}
          onConnect={() => handleOAuthConnect('github', getGitHubAuthUrl, setGithubLinked)}
        />

        <AccountCard
          title="Jira"
          subtitle="Project tracking"
          icon={
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#0052CC]">
              <Feather name="trello" size={28} color="white" />
            </View>
          }
          isLinked={jiraLinked}
          onConnect={() => handleOAuthConnect('jira', getJiraAuthUrl, setJiraLinked)}
          buttonColor="#253240"
        />

        <View className="flex-row items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <MaterialIcons name="info" size={16} color="#eab308" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-xs leading-relaxed text-yellow-400">
            These connections can be updated anytime from Settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LinkedAccountsScreen;
