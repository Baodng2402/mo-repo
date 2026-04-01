import React, { useCallback, useMemo, useState } from 'react';
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
import {
  generateSrsReport,
  getCommitReport,
  type CommitContributor,
  type CommitReport,
  type CommitRepositoryReport,
} from '@/services/reportService';
import { showError, showSuccess } from '@/utils/toast';

type ReportMode = 'none' | 'srs' | 'commit';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name
    .split(/[\s_@-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const AVATAR_COLORS = [
  '#7C3AED',
  '#2563EB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#0891B2',
  '#7C3AED',
  '#BE185D',
];

const avatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// ─── Sub-components ─────────────────────────────────────────────────────────

const AuthorAvatar = ({ name, size = 36 }: { name: string; size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: avatarColor(name),
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700' }}>
      {getInitials(name)}
    </Text>
  </View>
);

const ContributorRow = ({
  contributor,
  maxCommits,
  rank,
}: {
  contributor: CommitContributor;
  maxCommits: number;
  rank: number;
}) => {
  const pct = maxCommits > 0 ? contributor.commits / maxCommits : 0;
  const rankColors = ['#F59E0B', '#94A3B8', '#CD7C2F'];
  const rankLabel = rank <= 3 ? ['1st', '2nd', '3rd'][rank - 1] : null;

  return (
    <View className="mb-3">
      <View className="flex-row items-center gap-3">
        <View className="relative">
          <AuthorAvatar name={contributor.author} size={38} />
          {rankLabel && (
            <View
              className="absolute -bottom-1 -right-1 items-center justify-center rounded-full px-1"
              style={{ backgroundColor: rankColors[rank - 1], minWidth: 18, height: 14 }}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>{rankLabel}</Text>
            </View>
          )}
        </View>

        <View className="flex-1">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-white" numberOfLines={1}>
              {contributor.author}
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1">
                <Feather name="git-commit" size={11} color="#A78BFA" />
                <Text className="text-xs font-bold text-[#A78BFA]">
                  {fmtNum(contributor.commits)}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-[#243447]">
            <View
              className="h-full rounded-full bg-[#7C3AED]"
              style={{ width: `${Math.max(pct * 100, 2)}%` }}
            />
          </View>

          {/* Lines stats */}
          {(contributor.lines_added > 0 || contributor.lines_deleted > 0) && (
            <View className="flex-row gap-3">
              <View className="flex-row items-center gap-1">
                <Text className="text-[10px] font-semibold text-[#34D399]">
                  +{fmtNum(contributor.lines_added)}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-[10px] font-semibold text-[#F87171]">
                  -{fmtNum(contributor.lines_deleted)}
                </Text>
              </View>
              {contributor.net_change !== 0 && (
                <Text
                  className="text-[10px] text-gray-500"
                  style={{ color: contributor.net_change >= 0 ? '#34D399' : '#F87171' }}>
                  net {contributor.net_change >= 0 ? '+' : ''}
                  {fmtNum(contributor.net_change)}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const RepoCard = ({ repo, index }: { repo: CommitRepositoryReport; index: number }) => {
  const [expanded, setExpanded] = useState(true);
  const repoName = repo.repository.split('/').pop() ?? repo.repository;
  const ownerName = repo.repository.includes('/') ? repo.repository.split('/')[0] : '';

  const totalCommits = repo.contributors.reduce((s, c) => s + c.commits, 0);
  const maxCommits = repo.contributors[0]?.commits ?? 0;

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl"
      style={{ backgroundColor: '#131C27', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
      {/* Repo header */}
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
        className="flex-row items-center px-4 py-3">
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}>
          <Feather name="git-branch" size={16} color="#A78BFA" />
        </View>

        <View className="flex-1">
          <Text className="text-sm font-bold text-white">{repoName}</Text>
          {ownerName ? <Text className="text-[11px] text-gray-500">{ownerName}</Text> : null}
        </View>

        <View className="mr-3 items-end">
          <Text className="text-xs font-bold text-[#A78BFA]">{totalCommits}</Text>
          <Text className="text-[10px] text-gray-500">commits</Text>
        </View>

        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
      </TouchableOpacity>

      {expanded && (
        <View className="border-t border-white/5 px-4 pb-4 pt-3">
          {repo.contributors.length === 0 ? (
            <View className="items-center rounded-xl bg-[#1A2332] py-5">
              <Feather name="users" size={20} color="#4B5563" />
              <Text className="mt-2 text-xs text-gray-500">No contributors found</Text>
            </View>
          ) : (
            repo.contributors.map((c, i) => (
              <ContributorRow
                key={`${repo.repository}-${c.author}`}
                contributor={c}
                maxCommits={maxCommits}
                rank={i + 1}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
};

const CommitSummaryBanner = ({ commit }: { commit: CommitReport }) => {
  const totalCommits = useMemo(
    () =>
      commit.repositories.reduce(
        (sum, r) => sum + r.contributors.reduce((s, c) => s + c.commits, 0),
        0
      ),
    [commit]
  );

  const totalContributors = useMemo(() => {
    const set = new Set<string>();
    commit.repositories.forEach((r) => r.contributors.forEach((c) => set.add(c.author)));
    return set.size;
  }, [commit]);

  return (
    <View
      className="mb-4 overflow-hidden rounded-2xl p-4"
      style={{ backgroundColor: '#131C27', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' }}>
      <View className="mb-3 flex-row items-center gap-2">
        <View
          className="h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(124,58,237,0.2)' }}>
          <Feather name="bar-chart-2" size={15} color="#A78BFA" />
        </View>
        <Text className="text-base font-bold text-white">{commit.groupName}</Text>
      </View>

      <View className="flex-row gap-3">
        <View
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: 'rgba(124,58,237,0.1)' }}>
          <Text className="text-xl font-bold text-[#A78BFA]">{fmtNum(totalCommits)}</Text>
          <Text className="mt-0.5 text-[10px] text-gray-400">Total Commits</Text>
        </View>
        <View
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: 'rgba(52,211,153,0.08)' }}>
          <Text className="text-xl font-bold text-[#34D399]">{totalContributors}</Text>
          <Text className="mt-0.5 text-[10px] text-gray-400">Contributors</Text>
        </View>
        <View
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: 'rgba(96,165,250,0.08)' }}>
          <Text className="text-xl font-bold text-[#60A5FA]">{commit.repositories.length}</Text>
          <Text className="mt-0.5 text-[10px] text-gray-400">Repos</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

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

      {/* Header */}
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
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}>
        {/* Action buttons */}
        <View className="mb-5 flex-row gap-3">
          <TouchableOpacity
            onPress={runSrs}
            activeOpacity={0.8}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
            style={{ backgroundColor: mode === 'srs' ? '#7C3AED' : '#1A2332' }}>
            <Feather name="file-text" size={15} color={mode === 'srs' ? '#fff' : '#A78BFA'} />
            <Text
              className="text-sm font-semibold"
              style={{ color: mode === 'srs' ? '#fff' : '#A78BFA' }}>
              Generate SRS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={runCommit}
            activeOpacity={0.8}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
            style={{ backgroundColor: mode === 'commit' ? '#16A34A' : '#1A2332' }}>
            <Feather name="git-commit" size={15} color={mode === 'commit' ? '#fff' : '#34D399'} />
            <Text
              className="text-sm font-semibold"
              style={{ color: mode === 'commit' ? '#fff' : '#34D399' }}>
              Commits
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loading ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text className="mt-3 text-xs text-gray-500">
              {mode === 'commit' ? 'Fetching commit data…' : 'Generating report…'}
            </Text>
          </View>
        ) : null}

        {/* Empty state */}
        {!loading && mode === 'none' ? (
          <View className="items-center rounded-2xl bg-[#1A2332] px-6 py-10">
            <View
              className="mb-4 h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(124,58,237,0.12)' }}>
              <Feather name="bar-chart-2" size={26} color="#7C3AED" />
            </View>
            <Text className="text-center text-sm font-semibold text-white">
              Select a report type
            </Text>
            <Text className="mt-1 text-center text-xs text-gray-500">
              Generate SRS documentation or view GitHub commit analytics for your group.
            </Text>
          </View>
        ) : null}

        {/* SRS */}
        {!loading && mode === 'srs' ? (
          <View className="rounded-2xl bg-[#1A2332] p-4">
            <View className="mb-3 flex-row items-center gap-2">
              <Feather name="file-text" size={15} color="#A78BFA" />
              <Text className="font-semibold text-white">SRS Markdown</Text>
            </View>
            <Text className="text-xs leading-5 text-gray-300">{srs}</Text>
          </View>
        ) : null}

        {/* Commit Report */}
        {!loading && mode === 'commit' && commit ? (
          <View>
            <CommitSummaryBanner commit={commit} />

            {commit.repositories.length === 0 ? (
              <View className="items-center rounded-2xl bg-[#1A2332] px-6 py-8">
                <Feather name="git-branch" size={24} color="#4B5563" />
                <Text className="mt-3 text-center text-sm font-semibold text-gray-400">
                  No linked repositories
                </Text>
                <Text className="mt-1 text-center text-xs text-gray-500">
                  Link a GitHub repository to this group to see commit data.
                </Text>
              </View>
            ) : (
              commit.repositories.map((repo, index) => (
                <RepoCard key={repo.repository} repo={repo} index={index} />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportsScreen;
