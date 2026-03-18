import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Image,
    Linking,
    InteractionManager,
    Modal,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import {
    getGroupById,
    leaveGroup,
    removeMember,
    updateMemberRole,
    deleteGroup,
    getGroupRepos,
} from '@/services/groupService';
import { getContributorStats, getCommits } from '@/services/githubService';
import { getAssignmentReport, type AssignmentItem } from '@/services/reportService';
import { showSuccess, showError } from '@/utils/toast';
import type { GroupDetail, GroupMember, MembershipRole } from '@/types/group';
import type { ContributorStat, GroupRepo } from '@/types/github';
import type { JiraTaskStatus } from '@/types/activity';
import { JIRA_STATUS_CONFIG } from '@/types/activity';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserStore } from '@/utils/stores/userStore';

// ==================== Constants ====================

/** Role hierarchy — higher number = higher rank */
const ROLE_RANK: Record<string, number> = {
    MEMBER: 0,
    MENTOR: 1,
    LEADER: 2,
};

/** Role badge display config */
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
    LEADER: { label: 'Leader', color: '#7C3AED' },
    MENTOR: { label: 'Mentor', color: '#06B6D4' },
    MEMBER: { label: 'Member', color: '#64748B' },
};

/** Status indicator colors */
const STATUS_COLORS: Record<string, string> = {
    ACTIVE: '#22C55E',
    ARCHIVED: '#EAB308',
    COMPLETED: '#3B82F6',
};

const normalizeStatus = (status: string): JiraTaskStatus => {
    const s = status.toUpperCase();
    if (s.includes('DONE')) return 'DONE';
    if (s.includes('PROGRESS') || s.includes('IN_')) return 'IN_PROGRESS';
    return 'TO_DO';
};

// ==================== Component ====================

const GroupDetailScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
    const { groupId } = route.params;

    const currentUser = useUserStore((s) => s.userInfo);
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // GitHub linked repos & contributor stats
    const [linkedRepos, setLinkedRepos] = useState<GroupRepo[]>([]);
    const [contributorStats, setContributorStats] = useState<ContributorStat[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);
    const [groupTasks, setGroupTasks] = useState<AssignmentItem[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    // ── Derived State ───────────────────────────────

    const currentMember = group?.members.find((m) => m.id === currentUser?.id);
    const isLeader = currentMember?.role_in_group === 'LEADER';
    const isAdmin = currentMember?.role_in_group === 'MENTOR';
    const currentRank = ROLE_RANK[currentMember?.role_in_group || 'MEMBER'] ?? 0;

    /** Check if current user outranks a target member */
    const canRemove = (target: GroupMember) =>
        currentRank > (ROLE_RANK[target.role_in_group] ?? 0);

    // ── Fetch Data ──────────────────────────────────

    const fetchGroup = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getGroupById(groupId);
            setGroup(data);

            setLoadingTasks(true);
            const assignmentReport = await getAssignmentReport(groupId).catch(() => null);
            setGroupTasks(assignmentReport?.assignments || []);
            setLoadingTasks(false);

            // Fetch linked repos + stats
            try {
                const repos = await getGroupRepos(groupId);
                setLinkedRepos(repos);

                // Determine which repo to fetch stats for
                let owner = '';
                let repoName = '';

                const primaryRepo = repos.find((r) => r.is_primary) || repos[0];
                if (primaryRepo) {
                    owner = primaryRepo.repo_owner;
                    repoName = primaryRepo.repo_name;
                } else if (data.github_repo_url) {
                    // Fallback: parse owner/repo from github_repo_url field
                    const match = data.github_repo_url.match(
                        /github\.com\/([^/]+)\/([^/]+)/,
                    );
                    if (match) {
                        owner = match[1];
                        repoName = match[2].replace(/\.git$/, '');
                    }
                }

                if (owner && repoName) {
                    setLoadingStats(true);

                    // Fetch both: commits for accurate count, stats for LOC
                    const [commits, stats] = await Promise.all([
                        getCommits(owner, repoName).catch(() => []),
                        getContributorStats(owner, repoName).catch(() => []),
                    ]);

                    // Count commits per author from commits API
                    const commitCountMap: Record<string, number> = {};
                    for (const c of commits) {
                        const key = c.author || 'Unknown';
                        commitCountMap[key] = (commitCountMap[key] || 0) + 1;
                    }

                    // Merge: use commit count from commits API, LOC from stats API
                    const mergedStats: ContributorStat[] = stats.map((s) => ({
                        ...s,
                        commits: commitCountMap[s.author] ?? s.commits,
                    }));

                    // Add authors from commits API not in stats
                    for (const [author, count] of Object.entries(commitCountMap)) {
                        if (!stats.some((s) => s.author === author)) {
                            mergedStats.push({
                                author,
                                developer_id: 0,
                                commits: count,
                                lines_added: 0,
                                lines_deleted: 0,
                                net_change: 0,
                            });
                        }
                    }

                    setContributorStats(mergedStats);
                    setLoadingStats(false);
                }
            } catch {
                // Non-blocking — repos/stats may not be available
            }
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to load group');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [groupId, navigation]);

    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                fetchGroup();
            });
            return () => task.cancel();
        }, [fetchGroup]),
    );

    // ── Actions ─────────────────────────────────────

    /** Open GitHub repo URL in system browser */
    const handleOpenRepo = () => {
        if (group?.github_repo_url) {
            Linking.openURL(group.github_repo_url).catch(() =>
                showError('Cannot open this URL'),
            );
        }
    };

    // ── Modal State Machine ─────────────────────────
    // Instead of native Alert.alert, we use a single modal with different configs.
    type ModalConfig = {
        icon: string;
        iconColor: string;
        title: string;
        subtitle: string;
        confirmText: string;
        confirmColor: string;
        onConfirm: () => Promise<void>;
    };

    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
    const [showActionSheet, setShowActionSheet] = useState(false);
    const selectedMemberRef = useRef<GroupMember | null>(null);

    const closeModal = () => setModalConfig(null);

    /** Leave group */
    const handleLeaveGroup = () => {
        setModalConfig({
            icon: 'log-out',
            iconColor: '#F97316',
            title: 'Leave group?',
            subtitle: 'You will lose access to this group and its resources.',
            confirmText: 'Leave',
            confirmColor: '#F97316',
            onConfirm: async () => {
                try {
                    await leaveGroup(groupId);
                    showSuccess('You have left the group');
                    navigation.goBack();
                } catch (error: any) {
                    showError(error.response?.data?.message || 'Failed to leave group');
                }
            },
        });
    };

    /** Delete group (leader only) */
    const handleDeleteGroup = () => {
        setModalConfig({
            icon: 'trash-2',
            iconColor: '#EF4444',
            title: 'Delete group?',
            subtitle: 'This action cannot be undone. All data will be permanently removed.',
            confirmText: 'Delete',
            confirmColor: '#EF4444',
            onConfirm: async () => {
                try {
                    await deleteGroup(groupId);
                    showSuccess('Group deleted');
                    navigation.goBack();
                } catch (error: any) {
                    showError(error.response?.data?.message || 'Failed to delete group');
                }
            },
        });
    };

    /** Remove member */
    const handleRemoveMember = (member: GroupMember) => {
        setShowActionSheet(false);
        setTimeout(() => {
            setModalConfig({
                icon: 'user-minus',
                iconColor: '#EF4444',
                title: `Remove ${member.full_name}?`,
                subtitle: 'They will lose access to this group immediately.',
                confirmText: 'Remove',
                confirmColor: '#EF4444',
                onConfirm: async () => {
                    try {
                        await removeMember(groupId, member.id);
                        showSuccess(`${member.full_name} has been removed`);
                        fetchGroup();
                    } catch (error: any) {
                        showError(error.response?.data?.message || 'Failed to remove member');
                    }
                },
            });
        }, 300);
    };

    /** Change role */
    const handleChangeRole = async (member: GroupMember, newRole: MembershipRole) => {
        setShowActionSheet(false);
        try {
            await updateMemberRole(groupId, member.id, newRole);
            const roleLabel = newRole.charAt(0) + newRole.slice(1).toLowerCase();
            showSuccess(`${member.full_name} is now ${roleLabel}`);
            fetchGroup();
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to update role');
        }
    };

    /** Open member action sheet */
    const openMemberActions = (member: GroupMember) => {
        selectedMemberRef.current = member;
        setShowActionSheet(true);
    };

    // ── Render: Status Badge ────────────────────────

    const renderStatusBadge = (status: JiraTaskStatus) => {
        const cfg = JIRA_STATUS_CONFIG[status];
        return (
            <View
                className="px-2 py-0.5 rounded-md"
                style={{ backgroundColor: cfg.bg + '20' }}
            >
                <Text
                    className="text-[10px] font-bold"
                    style={{ color: cfg.color }}
                >
                    {cfg.label}
                </Text>
            </View>
        );
    };

    // ── Render: Member Row ──────────────────────────

    const renderMember = (member: GroupMember, index: number) => {
        const roleCfg = ROLE_CONFIG[member.role_in_group] || ROLE_CONFIG.MEMBER;
        const isCurrentUser = member.id === currentUser?.id;
        const isLast = index === (group?.members.length ?? 0) - 1;

        return (
            <View
                key={member.id}
                className={`flex-row items-center justify-between py-3.5 ${!isLast ? 'border-b border-white/5' : ''
                    }`}
            >
                {/* Avatar + Info */}
                <View className="flex-row items-center flex-1">
                    {member.avatar_url ? (
                        <Image
                            source={{ uri: member.avatar_url }}
                            className="w-10 h-10 rounded-full"
                        />
                    ) : (
                        <View className="w-10 h-10 rounded-full bg-[#243447] items-center justify-center">
                            <Text className="text-white font-bold text-sm">
                                {member.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}

                    <View className="ml-3 flex-1">
                        <View className="flex-row items-center gap-1.5">
                            <Text
                                className="text-white font-semibold text-sm"
                                numberOfLines={1}
                            >
                                {member.full_name}
                            </Text>
                            {isCurrentUser && (
                                <Text className="text-gray-500 text-[11px]">(you)</Text>
                            )}
                        </View>
                        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
                            {member.email}
                        </Text>
                    </View>
                </View>

                {/* Role Badge + Actions */}
                <View className="flex-row items-center gap-2">
                    <View
                        className="px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: roleCfg.color + '20' }}
                    >
                        <Text
                            style={{ color: roleCfg.color }}
                            className="text-[10px] font-bold"
                        >
                            {roleCfg.label}
                        </Text>
                    </View>

                    {/* Show ⋮ menu for leader/admin on lower-rank members only */}
                    {!isCurrentUser && (isLeader || isAdmin) && canRemove(member) && (
                        <TouchableOpacity
                            onPress={() => openMemberActions(member)}
                            className="p-1"
                        >
                            <Feather name="more-vertical" size={16} color="#64748B" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    // ── Loading State ───────────────────────────────

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
            </SafeAreaView>
        );
    }

    if (!group) return null;

    const statusColor = STATUS_COLORS[group.status] || '#64748B';

    // ── Main Render ─────────────────────────────────

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* ── Header ──────────────────────────────── */}
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
                >
                    <Feather name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>

                <View className="flex-1 ml-3">
                    <Text className="text-white text-lg font-bold" numberOfLines={1}>
                        {group.name}
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-0.5">
                        <View
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: statusColor }}
                        />
                        <Text className="text-gray-400 text-xs">{group.status}</Text>
                    </View>
                </View>

                {isLeader && (
                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate('EditGroup', { groupId: group.id })
                        }
                        className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
                    >
                        <Feather name="edit-2" size={18} color="#7C3AED" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Body ────────────────────────────────── */}
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Group Info Card ───────────────────── */}
                <View className="mx-4 mt-3 bg-[#1A2332] rounded-2xl p-4">
                    {group.project_name && (
                        <View className="mb-3">
                            <Text className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">
                                Project
                            </Text>
                            <Text className="text-white font-semibold text-[15px]">
                                {group.project_name}
                            </Text>
                        </View>
                    )}

                    {group.description && (
                        <View className="mb-3">
                            <Text className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">
                                Description
                            </Text>
                            <Text className="text-gray-300 text-sm leading-5">
                                {group.description}
                            </Text>
                        </View>
                    )}

                    {/* Meta Info */}
                    <View className="flex-row flex-wrap gap-3">
                        {group.semester && (
                            <View className="flex-row items-center gap-1.5">
                                <Feather name="calendar" size={13} color="#64748B" />
                                <Text className="text-gray-400 text-sm">{group.semester}</Text>
                            </View>
                        )}
                        <View className="flex-row items-center gap-1.5">
                            <MaterialIcons name="group" size={14} color="#64748B" />
                            <Text className="text-gray-400 text-sm">
                                {group.members_count} member
                                {group.members_count !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>

                    {/* Integration Tags */}
                    {(group.jira_project_key || group.github_repo_url) && (
                        <View className="flex-row gap-2 mt-4 pt-3 border-t border-white/5">
                            {group.jira_project_key && (
                                <View className="bg-[#0052CC]/15 px-3 py-2 rounded-xl flex-row items-center gap-1.5">
                                    <MaterialIcons name="dashboard" size={14} color="#4C9AFF" />
                                    <Text className="text-[#4C9AFF] text-xs font-semibold">
                                        {group.jira_project_key}
                                    </Text>
                                </View>
                            )}
                            {group.github_repo_url && (
                                <TouchableOpacity
                                    onPress={handleOpenRepo}
                                    activeOpacity={0.7}
                                    className="bg-[#7C3AED]/15 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                                >
                                    <Feather name="github" size={14} color="#A855F7" />
                                    <Text className="text-[#A855F7] text-xs font-semibold">
                                        Repository
                                    </Text>
                                    <Feather name="external-link" size={11} color="#A855F7" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Quick Actions */}
                    <View className="mt-4 pt-3 border-t border-white/5 flex-row gap-2">
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Documents', { groupId: group.id })}
                            className="flex-1 bg-[#243447] rounded-xl py-2.5 items-center"
                            activeOpacity={0.8}
                        >
                            <Text className="text-[#93C5FD] text-xs font-semibold">Documents</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Reports', { groupId: group.id })}
                            className="flex-1 bg-[#243447] rounded-xl py-2.5 items-center"
                            activeOpacity={0.8}
                        >
                            <Text className="text-[#A78BFA] text-xs font-semibold">Reports</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── GitHub Contributions (Real Data) ───── */}
                {(linkedRepos.length > 0 || contributorStats.length > 0 || loadingStats || group.github_repo_url) && (
                    <View className="mx-4 mt-4">
                        <View className="flex-row items-center gap-2 mb-3">
                            <Feather name="git-commit" size={18} color="#A855F7" />
                            <Text className="text-white text-base font-bold">
                                Contributions
                            </Text>
                            {linkedRepos.length > 1 && (
                                <Text className="text-gray-500 text-xs">
                                    ({linkedRepos.length} repos)
                                </Text>
                            )}
                        </View>

                        <View className="bg-[#1A2332] rounded-2xl p-4">
                            {loadingStats ? (
                                <ActivityIndicator size="small" color="#A855F7" style={{ paddingVertical: 16 }} />
                            ) : contributorStats.length > 0 ? (
                                <>
                                    {contributorStats.map((stat, idx) => {
                                        const maxCommits = Math.max(...contributorStats.map((s) => s.commits), 1);
                                        const isLast = idx === contributorStats.length - 1;
                                        const contributorKey = `contrib-${stat.developer_id ?? 'na'}-${stat.author ?? 'unknown'}-${idx}`;
                                        return (
                                            <View
                                                key={contributorKey}
                                                className={`flex-row items-center justify-between py-3 ${!isLast ? 'border-b border-white/5' : ''}`}
                                            >
                                                <View className="flex-row items-center flex-1">
                                                    {stat.avatar_url ? (
                                                        <Image
                                                            source={{ uri: stat.avatar_url }}
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                    ) : (
                                                        <View className="w-8 h-8 rounded-full bg-[#243447] items-center justify-center">
                                                            <Text className="text-white font-bold text-xs">
                                                                {stat.author?.charAt(0)?.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    <View className="ml-2.5 flex-1">
                                                        <Text className="text-white text-sm" numberOfLines={1}>
                                                            {stat.author}
                                                        </Text>
                                                        <Text className="text-gray-500 text-[10px]">
                                                            +{stat.lines_added.toLocaleString()} / -{stat.lines_deleted.toLocaleString()}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View className="flex-row items-center gap-3">
                                                    <View className="items-center">
                                                        <Text className="text-white font-bold text-sm">
                                                            {stat.commits}
                                                        </Text>
                                                        <Text className="text-gray-500 text-[9px]">
                                                            commits
                                                        </Text>
                                                    </View>
                                                    <View className="w-16 h-1.5 bg-[#243447] rounded-full overflow-hidden">
                                                        <View
                                                            className="h-full rounded-full bg-[#A855F7]"
                                                            style={{ width: `${Math.round((stat.commits / maxCommits) * 100)}%` }}
                                                        />
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </>
                            ) : (
                                <Text className="text-gray-500 text-sm text-center py-4">
                                    No contribution data yet
                                </Text>
                            )}

                            {/* Linked repos list */}
                            <View className="mt-3 pt-3 border-t border-white/5 gap-2">
                                {linkedRepos.length > 0
                                    ? linkedRepos.map((repo) => (
                                        <TouchableOpacity
                                            key={repo.id}
                                            onPress={() =>
                                                Linking.openURL(repo.repo_url).catch(() =>
                                                    showError('Cannot open this URL'),
                                                )
                                            }
                                            activeOpacity={0.8}
                                            className="flex-row items-center justify-between bg-[#243447] py-2.5 px-3 rounded-xl"
                                        >
                                            <View className="flex-row items-center gap-2 flex-1">
                                                <Feather name="github" size={14} color="#A855F7" />
                                                <Text className="text-[#A855F7] text-sm font-semibold" numberOfLines={1}>
                                                    {repo.repo_owner}/{repo.repo_name}
                                                </Text>
                                            </View>
                                            <Feather name="external-link" size={11} color="#A855F7" />
                                        </TouchableOpacity>
                                    ))
                                    : group.github_repo_url && (
                                        <TouchableOpacity
                                            onPress={() =>
                                                Linking.openURL(group.github_repo_url!).catch(() =>
                                                    showError('Cannot open this URL'),
                                                )
                                            }
                                            activeOpacity={0.8}
                                            className="flex-row items-center justify-center gap-2 bg-[#243447] py-2.5 rounded-xl"
                                        >
                                            <Feather name="github" size={14} color="#A855F7" />
                                            <Text className="text-[#A855F7] text-sm font-semibold">
                                                View on GitHub
                                            </Text>
                                            <Feather name="external-link" size={11} color="#A855F7" />
                                        </TouchableOpacity>
                                    )}
                            </View>
                        </View>
                    </View>
                )}

                {/* ── Task Tracker Section ─────────────── */}
                <View className="mx-4 mt-4">
                    <View className="flex-row items-center gap-2 mb-3">
                        <MaterialIcons name="assignment" size={18} color="#4C9AFF" />
                        <Text className="text-white text-base font-bold">
                            Task Tracker
                        </Text>
                    </View>

                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        {/* Summary bar: count per status */}
                        <View className="flex-row gap-2 mb-4">
                            {(['TO_DO', 'IN_PROGRESS', 'DONE'] as JiraTaskStatus[]).map(
                                (status) => {
                                    const cfg = JIRA_STATUS_CONFIG[status];
                                    const count = groupTasks.filter(
                                        (t) => normalizeStatus(t.status) === status,
                                    ).length;
                                    return (
                                        <View
                                            key={status}
                                            className="flex-1 bg-[#243447] rounded-xl py-2.5 items-center"
                                        >
                                            <View
                                                className="w-2 h-2 rounded-full mb-1"
                                                style={{ backgroundColor: cfg.color }}
                                            />
                                            <Text className="text-white font-bold text-sm">
                                                {count}
                                            </Text>
                                            <Text className="text-gray-500 text-[9px]">
                                                {cfg.label}
                                            </Text>
                                        </View>
                                    );
                                },
                            )}
                        </View>

                        {/* Task list */}
                        {loadingTasks ? (
                            <ActivityIndicator size="small" color="#4C9AFF" style={{ paddingVertical: 12 }} />
                        ) : groupTasks.length > 0 ? (
                            groupTasks.map((task, idx) => (
                                <View
                                    key={task.key}
                                    className={`flex-row items-center justify-between py-3 ${idx < groupTasks.length - 1
                                        ? 'border-b border-white/5'
                                        : ''
                                        }`}
                                >
                                    <View className="flex-1 mr-3">
                                        <View className="flex-row items-center gap-2 mb-1">
                                            <Text className="text-gray-500 text-[10px] font-mono">
                                                {task.key}
                                            </Text>
                                            {renderStatusBadge(normalizeStatus(task.status))}
                                        </View>
                                        <Text className="text-white text-sm" numberOfLines={1}>
                                            {task.summary}
                                        </Text>
                                        <Text className="text-gray-500 text-[10px] mt-1" numberOfLines={1}>
                                            {task.assignee || 'Unassigned'}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View className="mt-1 bg-[#243447] rounded-xl p-3 flex-row items-center gap-2">
                                <MaterialIcons name="info-outline" size={14} color="#64748B" />
                                <Text className="text-gray-500 text-xs flex-1">
                                    No Jira tasks available for this group yet.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Members Section ──────────────────── */}
                <View className="mx-4 mt-4">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-white text-base font-bold">
                            Members ({group.members.length})
                        </Text>
                        {isLeader && (
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('AddMember', { groupId: group.id })
                                }
                                activeOpacity={0.8}
                                className="flex-row items-center gap-1 bg-[#7C3AED]/15 px-3 py-1.5 rounded-lg"
                            >
                                <Feather name="user-plus" size={14} color="#7C3AED" />
                                <Text className="text-[#7C3AED] text-xs font-semibold">
                                    Add
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="bg-[#1A2332] rounded-2xl px-4">
                        {group.members.map((member, index) =>
                            renderMember(member, index),
                        )}
                    </View>
                </View>

                {/* ── Leader Actions ───────────────────── */}
                <View className="mx-4 mt-6 gap-3">
                    {/* Evaluation Button (leader only) */}
                    {isLeader && (
                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate('Evaluation', { groupId: group.id })
                            }
                            activeOpacity={0.8}
                            className="flex-row items-center justify-center gap-2 bg-[#7C3AED] py-3.5 rounded-xl"
                        >
                            <MaterialIcons name="assessment" size={18} color="#fff" />
                            <Text className="text-white font-semibold">
                                Evaluate Members
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Leave — any member (including leader) can leave */}
                    {currentMember && (
                        <TouchableOpacity
                            onPress={handleLeaveGroup}
                            activeOpacity={0.8}
                            className="flex-row items-center justify-center gap-2 bg-red-500/10 py-3.5 rounded-xl"
                        >
                            <Feather name="log-out" size={16} color="#EF4444" />
                            <Text className="text-red-400 font-semibold">Leave Group</Text>
                        </TouchableOpacity>
                    )}

                    {isLeader && (
                        <TouchableOpacity
                            onPress={handleDeleteGroup}
                            activeOpacity={0.8}
                            className="flex-row items-center justify-center gap-2 bg-red-500/10 py-3.5 rounded-xl"
                        >
                            <Feather name="trash-2" size={16} color="#EF4444" />
                            <Text className="text-red-400 font-semibold">Delete Group</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* ═══════════════════════════════════════════════════
                Confirm Modal (leave / delete / remove member)
               ═══════════════════════════════════════════════════ */}
            <Modal
                visible={!!modalConfig}
                transparent
                animationType="fade"
                onRequestClose={closeModal}
            >
                <Pressable
                    onPress={closeModal}
                    className="flex-1 bg-black/60 items-center justify-center px-8"
                >
                    <Pressable onPress={() => { }} className="bg-[#1A2332] rounded-2xl w-full p-6">
                        {/* Icon */}
                        <View className="items-center mb-4">
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center"
                                style={{ backgroundColor: (modalConfig?.iconColor || '#EF4444') + '20' }}
                            >
                                <Feather
                                    name={(modalConfig?.icon as any) || 'alert-circle'}
                                    size={28}
                                    color={modalConfig?.iconColor || '#EF4444'}
                                />
                            </View>
                        </View>

                        <Text className="text-white text-xl font-bold text-center mb-2">
                            {modalConfig?.title}
                        </Text>
                        <Text className="text-gray-400 text-sm text-center mb-6">
                            {modalConfig?.subtitle}
                        </Text>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={closeModal}
                                activeOpacity={0.8}
                                className="flex-1 bg-white/5 rounded-xl py-3.5 items-center"
                            >
                                <Text className="text-white font-semibold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={async () => {
                                    await modalConfig?.onConfirm();
                                    closeModal();
                                }}
                                activeOpacity={0.8}
                                className="flex-1 rounded-xl py-3.5 items-center"
                                style={{ backgroundColor: modalConfig?.confirmColor || '#EF4444' }}
                            >
                                <Text className="text-white font-semibold">
                                    {modalConfig?.confirmText}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ═══════════════════════════════════════════════════
                Member Action Sheet (change role / remove)
               ═══════════════════════════════════════════════════ */}
            <Modal
                visible={showActionSheet}
                transparent
                animationType="slide"
                onRequestClose={() => setShowActionSheet(false)}
            >
                <Pressable
                    onPress={() => setShowActionSheet(false)}
                    className="flex-1 bg-black/60 justify-end"
                >
                    <Pressable onPress={() => { }} className="bg-[#1A2332] rounded-t-3xl px-4 pb-8 pt-3">
                        {/* Handle Bar */}
                        <View className="w-10 h-1 bg-white/20 rounded-full self-center mb-4" />

                        <Text className="text-white text-lg font-bold mb-1">
                            {selectedMemberRef.current?.full_name}
                        </Text>
                        <Text className="text-gray-500 text-sm mb-4">
                            Current role: {selectedMemberRef.current?.role_in_group}
                        </Text>

                        {/* Role Options */}
                        <Text className="text-gray-600 text-xs font-semibold mb-2 ml-1">
                            CHANGE ROLE
                        </Text>
                        {(['MEMBER', 'LEADER', 'MENTOR'] as MembershipRole[])
                            .filter((r) => r !== selectedMemberRef.current?.role_in_group)
                            .map((role) => (
                                <TouchableOpacity
                                    key={role}
                                    onPress={() =>
                                        selectedMemberRef.current &&
                                        handleChangeRole(selectedMemberRef.current, role)
                                    }
                                    activeOpacity={0.7}
                                    className="flex-row items-center py-3.5 px-3 bg-white/5 rounded-xl mb-2"
                                >
                                    <Feather
                                        name={role === 'LEADER' ? 'star' : role === 'MENTOR' ? 'award' : 'user'}
                                        size={18}
                                        color="#A78BFA"
                                    />
                                    <Text className="text-white font-medium ml-3">
                                        Set as {role.charAt(0) + role.slice(1).toLowerCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}

                        {/* Remove — only if current user outranks the selected member */}
                        {selectedMemberRef.current && canRemove(selectedMemberRef.current) && (
                            <TouchableOpacity
                                onPress={() =>
                                    selectedMemberRef.current &&
                                    handleRemoveMember(selectedMemberRef.current)
                                }
                                activeOpacity={0.7}
                                className="flex-row items-center py-3.5 px-3 bg-red-500/10 rounded-xl mt-2"
                            >
                                <Feather name="user-minus" size={18} color="#EF4444" />
                                <Text className="text-red-400 font-medium ml-3">Remove from Group</Text>
                            </TouchableOpacity>
                        )}

                        {/* Cancel */}
                        <TouchableOpacity
                            onPress={() => setShowActionSheet(false)}
                            activeOpacity={0.8}
                            className="mt-4 bg-white/5 rounded-xl py-3.5 items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

export default GroupDetailScreen;
