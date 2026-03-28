import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { generateSrsReport, getCommitReport, type CommitReport } from '@/services/reportService';
import { showError, showSuccess } from '@/utils/toast';

type ReportMode = 'none' | 'srs' | 'commit';

const ReportsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Reports'>>();
  const { groupId } = route.params;

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ReportMode>('none');
  const [srs, setSrs] = useState('');
  const [commit, setCommit] = useState<CommitReport | null>(null);

  const runSrs = useCallback(async () => {
    try {
      setLoading(true);
      setMode('srs');
      const res = await generateSrsReport(groupId);
      setSrs(res.markdown || 'No SRS output');
      showSuccess('SRS generated');
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to generate SRS');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const runCommit = useCallback(async () => {
    try {
      setLoading(true);
      setMode('commit');
      const res = await getCommitReport(groupId);
      setCommit(res);
    } catch (error: any) {
      showError(
        error.response?.data?.message ||
          'Failed to load commit report. Ensure group has linked repos and GitHub integration.'
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="ml-3 text-lg font-bold text-white">Reports</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 30 }}>
        <View className="mb-4 flex-row gap-2">
          <TouchableOpacity
            onPress={runSrs}
            className="flex-1 items-center rounded-xl bg-[#7C3AED] py-3"
            activeOpacity={0.8}>
            <Text className="text-xs font-semibold text-white">Generate SRS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={runCommit}
            className="flex-1 items-center rounded-xl bg-[#16A34A] py-3"
            activeOpacity={0.8}>
            <Text className="text-xs font-semibold text-white">Commits</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : null}

        {!loading && mode === 'none' ? (
          <View className="items-center rounded-2xl bg-[#1A2332] p-5">
            <Text className="text-center text-gray-500">
              Choose a report above to load your group insights.
            </Text>
          </View>
        ) : null}

        {!loading && mode === 'srs' ? (
          <View className="rounded-2xl bg-[#1A2332] p-4">
            <Text className="mb-3 font-semibold text-white">SRS Markdown</Text>
            <Text className="text-xs leading-5 text-gray-300">{srs}</Text>
          </View>
        ) : null}
        {!loading && mode === 'commit' && commit ? (
          <View className="rounded-2xl bg-[#1A2332] p-4">
            <Text className="mb-3 font-semibold text-white">{commit.groupName}</Text>

            {commit.repositories.length === 0 ? (
              <View className="rounded-xl bg-[#243447] p-3">
                <Text className="text-center text-xs text-gray-400">
                  No linked repositories with commit data yet.
                </Text>
              </View>
            ) : (
              commit.repositories.map((repo, index) => (
                <View
                  key={repo.repository}
                  className={`mb-4 pb-3 ${index < commit.repositories.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <Text className="mb-2 text-sm font-semibold text-[#A78BFA]">
                    {repo.repository}
                  </Text>
                  {repo.contributors.length === 0 ? (
                    <Text className="text-xs text-gray-500">No contributors found.</Text>
                  ) : (
                    repo.contributors.map((c) => (
                      <Text
                        key={`${repo.repository}-${c.author}`}
                        className="mb-1 text-xs text-gray-300">
                        {c.author}: {c.commits} commits, +{c.lines_added}/-{c.lines_deleted}
                      </Text>
                    ))
                  )}
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportsScreen;
