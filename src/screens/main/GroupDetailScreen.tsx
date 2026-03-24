import React, { useState, useCallback, useRef } from 'react';
import {
    Alert,
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
    TextInput,
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
import { getJiraProjects } from '@/services/jiraService';
import { getContributorStats, getCommits } from '@/services/githubService';
import {
    createTask,
    deleteTask,
    getTasksPaginated,
    updateTask,
    type TaskItem,
    type TaskPriority,
    type TaskStatus,
} from '@/services/taskService';
import { showSuccess, showError, showInfo } from '@/utils/toast';
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


const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
// Status options for EDIT only — create status is controlled by BE based on assignee
const EDIT_STATUS_OPTIONS: TaskStatus[] = ['IN_PROGRESS', 'DONE', 'BLOCKED'];
const TASK_PAGE_SIZE = 30;

// Quick move: IN_PROGRESS → DONE → IN_PROGRESS (reopen)
// TO_DO tasks (unassigned) advance to IN_PROGRESS by quick-assign logic
const getNextStatus = (status: TaskStatus): TaskStatus => {
    if (status === 'TO_DO') return 'IN_PROGRESS';
    if (status === 'IN_PROGRESS') return 'DONE';
    if (status === 'DONE') return 'IN_PROGRESS'; // reopen
    return 'IN_PROGRESS'; // BLOCKED → unblock
};

const getValidJiraSiteOrigin = (rawUrl?: string | null): string | null => {
    if (!rawUrl) return null;

    try {
        const parsed = new URL(rawUrl);
        if (!parsed.hostname.toLowerCase().endsWith('.atlassian.net')) {
            return null;
        }

        return parsed.origin;
    } catch {
        return null;
    }
};

// ==================== Component ====================

const GroupDetailScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
    const { groupId } = route.params;

    const currentUser = useUserStore((s) => s.userInfo);
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [jiraSiteUrl, setJiraSiteUrl] = useState<string | null>(null);

    // GitHub linked repos & contributor stats
    const [linkedRepos, setLinkedRepos] = useState<GroupRepo[]>([]);
    const [contributorStats, setContributorStats] = useState<ContributorStat[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);
    const [groupTasks, setGroupTasks] = useState<TaskItem[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [loadingMoreTasks, setLoadingMoreTasks] = useState(false);
    const [taskPage, setTaskPage] = useState(1);
    const [hasMoreTasks, setHasMoreTasks] = useState(false);
    const [taskFallbackWarning, setTaskFallbackWarning] = useState('');
    const [taskSyncWarning, setTaskSyncWarning] = useState('');
    const [crudEnabled, setCrudEnabled] = useState(true);
    const [isTaskFormVisible, setTaskFormVisible] = useState(false);
    const [savingTask, setSavingTask] = useState(false);
    const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
    const [formStatus, setFormStatus] = useState<TaskStatus>('IN_PROGRESS');
    const [formDueDate, setFormDueDate] = useState('');
    const [formAssigneeId, setFormAssigneeId] = useState<string | null>(null);

    // ── Derived State ───────────────────────────────

    const currentMember = group?.members.find((m) => m.id === currentUser?.id);
    const isLeader = currentMember?.role_in_group === 'LEADER';
    const isAdmin = currentMember?.role_in_group === 'MENTOR';
    const currentRank = ROLE_RANK[currentMember?.role_in_group || 'MEMBER'] ?? 0;

    /** Check if current user outranks a target member */
    const canRemove = (target: GroupMember) =>
        currentRank > (ROLE_RANK[target.role_in_group] ?? 0);



    const fetchTasks = useCallback(
        async (reset: boolean, jiraProjectKey?: string) => {
            const targetPage = reset ? 1 : taskPage + 1;

            if (!reset) {
                if (loadingMoreTasks || !hasMoreTasks || !crudEnabled) return;
                setLoadingMoreTasks(true);
            } else {
                setLoadingTasks(true);
                setTaskFallbackWarning('');
            }

            try {
                const paginated = await getTasksPaginated({
                    group_id: groupId,
                    page: targetPage,
                    limit: TASK_PAGE_SIZE,
                });

                setCrudEnabled(true);
                setTaskFallbackWarning('');
                setTaskSyncWarning('');
                setTaskPage(paginated.meta.page);
                setHasMoreTasks(paginated.meta.page < paginated.meta.total_pages);
                setGroupTasks((prev) =>
                    reset ? paginated.data : [...prev, ...paginated.data],
                );

                if (reset && (jiraProjectKey || group?.jira_project_key)) {
                    const hasUnlinkedTasks = paginated.data.some((task) => {
                        const key = task.key?.trim();
                        return !key || !key.includes('-');
                    });
                    // Only warn if some tasks are missing Jira key (e.g. created before sync was enabled)
                    if (hasUnlinkedTasks && paginated.data.length > 0) {
                        setTaskSyncWarning(
                            'Some tasks predate Jira sync — they will be linked to Jira on next update.',
                        );
                    }
                }
            } catch (taskError: any) {
                if (reset) {
                    setGroupTasks([]);
                    setCrudEnabled(false);
                    setTaskPage(1);
                    setHasMoreTasks(false);
                    setTaskSyncWarning('');
                }

                showError(taskError?.response?.data?.message || 'Failed to load tasks');
            } finally {
                if (reset) {
                    setLoadingTasks(false);
                } else {
                    setLoadingMoreTasks(false);
                }
            }
        },
        [crudEnabled, groupId, hasMoreTasks, loadingMoreTasks, taskPage],
    );

    // ── Fetch Data ──────────────────────────────────

    const fetchGroup = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getGroupById(groupId);
            setGroup(data);

            // Fetch Jira site URL for deep-link badge (fire-and-forget)
            // Uses project.self which contains the actual Jira site URL
            // e.g. https://yoursite.atlassian.net/rest/api/3/project/10000
            if (data.jira_project_key) {
                getJiraProjects().then((projects) => {
                    const normalizedProjectKey = data.jira_project_key?.trim().toUpperCase();
                    const match = projects.find(
                        (p) => p.key?.trim().toUpperCase() === normalizedProjectKey,
                    );
                    console.log('[Jira] project self:', match?.self);

                    const siteOrigin =
                        getValidJiraSiteOrigin(match?.siteUrl) ||
                        getValidJiraSiteOrigin(match?.self);

                    if (siteOrigin) {
                        setJiraSiteUrl(siteOrigin);
                        return;
                    }
                }).catch(() => {});
                
            }

            await fetchTasks(true, data.jira_project_key);

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
    }, [fetchTasks, groupId, navigation]);

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

    /** Open Jira project board in system browser */
    const handleOpenJira = async () => {
        const projectKey = group?.jira_project_key?.trim();
        if (!projectKey) {
            showError('Jira project key is missing');
            return;
        }

        const validJiraSiteUrl = getValidJiraSiteOrigin(jiraSiteUrl);
        const projectUrl = validJiraSiteUrl
            ? `${validJiraSiteUrl}/jira/software/projects/${encodeURIComponent(projectKey)}/summary`
            : null;
        const fallbackUrl = 'https://start.atlassian.com';

        try {
            if (projectUrl) {
                const canOpenProjectUrl = await Linking.canOpenURL(projectUrl);
                if (canOpenProjectUrl) {
                    await Linking.openURL(projectUrl);
                    return;
                }
            }

            await Linking.openURL(fallbackUrl);
            showInfo(
                'Could not resolve project site, opened Atlassian home instead.',
            );
        } catch {
            showError('Cannot open Jira URL');
        }
    };

    const openCreateTaskModal = () => {
        setEditingTask(null);
        setFormTitle('');
        setFormDescription('');
        setFormPriority('MEDIUM');
        setFormStatus('IN_PROGRESS');
        setFormDueDate('');
        setFormAssigneeId(null);
        setTaskFormVisible(true);
    };

    const openEditTaskModal = (task: TaskItem) => {
        setEditingTask(task);
        setFormTitle(task.title || '');
        setFormDescription(task.description || '');
        setFormPriority(task.priority || 'MEDIUM');
        // Normalise: TO_DO is auto, so default edit status to IN_PROGRESS if task is unassigned TODO
        setFormStatus(task.status === 'TO_DO' ? 'IN_PROGRESS' : (task.status || 'IN_PROGRESS'));
        setFormDueDate(task.due_at ? task.due_at.slice(0, 10) : '');
        // Pre-fill assignee from current task assignee_name lookup
        const matched = group?.members.find((m) => m.full_name === task.assignee_name || m.email === task.assignee_name);
        setFormAssigneeId(matched?.id ?? null);
        setTaskFormVisible(true);
    };

    const handleSaveTask = async () => {
        if (!formTitle.trim()) {
            showError('Task title is required');
            return;
        }

        try {
            setSavingTask(true);

            if (editingTask) {
                await updateTask(editingTask.id, {
                    title: formTitle.trim(),
                    description: formDescription.trim() || undefined,
                    priority: formPriority,
                    status: formStatus,
                    assignee_id: formAssigneeId ?? undefined,
                    due_at: formDueDate.trim() || undefined,
                });
                showSuccess(
                    group?.jira_project_key
                        ? 'Task updated & synced to Jira'
                        : 'Task updated successfully',
                );
            } else {
                await createTask({
                    group_id: groupId,
                    title: formTitle.trim(),
                    description: formDescription.trim() || undefined,
                    priority: formPriority,
                    assignee_id: formAssigneeId ?? undefined,
                    due_at: formDueDate.trim() || undefined,
                    // status intentionally omitted — BE auto-sets based on assignee
                });
                showSuccess(
                    group?.jira_project_key
                        ? `Task created & Jira issue opened${formAssigneeId ? ' · assigned' : ''}`
                        : 'Task created successfully',
                );
            }

            setTaskFormVisible(false);
            fetchTasks(true);
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Failed to save task');
        } finally {
            setSavingTask(false);
        }
    };

    const handleDeleteTask = (task: TaskItem) => {
        if (!crudEnabled) return;

        Alert.alert('Delete task', `Delete "${task.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteTask(task.id);
                        showSuccess('Task deleted successfully');
                        fetchTasks(true);
                    } catch (error: any) {
                        showError(error?.response?.data?.message || 'Failed to delete task');
                    }
                },
            },
        ]);
    };

    const handleQuickMoveTask = async (task: TaskItem) => {
        const next = getNextStatus(task.status);
        try {
            await updateTask(task.id, { status: next });
            showSuccess(
                group?.jira_project_key
                    ? `Moved to ${next.replace('_', ' ')} · Jira synced`
                    : `Moved to ${next.replace('_', ' ')}`,
            );
            fetchTasks(true);
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Failed to update task status');
        }
    };

    const handleLoadMoreTasks = () => {
        fetchTasks(false);
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

                    {group.topic?.name && (
                        <View className="mb-3">
                            <Text className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">
                                Topic
                            </Text>
                            <Text className="text-white font-semibold text-[15px]">
                                {group.topic.name}
                            </Text>
                            {!!group.topic.description && (
                                <Text className="text-gray-400 text-sm leading-5 mt-1">
                                    {group.topic.description}
                                </Text>
                            )}
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
                                <TouchableOpacity
                                    onPress={handleOpenJira}
                                    activeOpacity={0.7}
                                    className="bg-[#0052CC]/15 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                                >
                                    <MaterialIcons name="dashboard" size={14} color="#4C9AFF" />
                                    <Text className="text-[#4C9AFF] text-xs font-semibold">
                                        {group.jira_project_key}
                                    </Text>
                                    <Feather name="external-link" size={11} color="#4C9AFF" />
                                </TouchableOpacity>
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
                        {isLeader && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('TopicLab', { groupId: group.id })}
                                className="flex-1 bg-[#243447] rounded-xl py-2.5 items-center"
                                activeOpacity={0.8}
                            >
                                <Text className="text-[#F59E0B] text-xs font-semibold">Topic Lab</Text>
                            </TouchableOpacity>
                        )}
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
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-2">
                            <MaterialIcons name="task" size={18} color="#4C9AFF" />
                            <Text className="text-white text-base font-bold">
                                Group Tasks
                            </Text>
                        </View>
                        {isLeader && (
                            <TouchableOpacity
                                onPress={openCreateTaskModal}
                                className={`px-3 py-2 rounded-lg ${crudEnabled ? 'bg-[#4C9AFF]/20' : 'bg-[#334155]'}`}
                                activeOpacity={0.8}
                            >
                                <Text className={`text-xs font-semibold ${crudEnabled ? 'text-[#93C5FD]' : 'text-gray-400'}`}>
                                    + New Task
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        {!!taskSyncWarning && crudEnabled && (
                            <View className="mb-4 bg-[#1E293B] rounded-xl p-3 border border-[#334155]">
                                <Text className="text-[#FCD34D] text-xs font-semibold">Jira sync notice</Text>
                                <Text className="text-gray-400 text-xs mt-1">{taskSyncWarning}</Text>
                            </View>
                        )}

                        {!crudEnabled && (
                            <View className="mb-4 bg-[#243447] rounded-xl p-3 border border-[#334155]">
                                <Text className="text-[#FCD34D] text-xs font-semibold">Read-only mode</Text>
                                <Text className="text-gray-400 text-xs mt-1">
                                    {taskFallbackWarning ||
                                        'BE task CRUD endpoints are not available yet. Showing Jira report data only.'}
                                </Text>
                            </View>
                        )}

                        {/* Summary bar: count per status */}
                        <View className="flex-row gap-2 mb-4">
                            {(['TO_DO', 'IN_PROGRESS', 'DONE'] as JiraTaskStatus[]).map(
                                (status) => {
                                    const cfg = JIRA_STATUS_CONFIG[status];
                                    const count = groupTasks.filter(
                                        (t) => t.status === status,
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
                            groupTasks.map((task, idx) => {
                                const cfg = JIRA_STATUS_CONFIG[task.status as JiraTaskStatus] ?? JIRA_STATUS_CONFIG.IN_PROGRESS;
                                const hasJiraKey = !!task.key?.includes('-');
                                return (
                                    <View
                                        key={task.id}
                                        className={`flex-row items-center justify-between py-3 ${idx < groupTasks.length - 1 ? 'border-b border-white/5' : ''}`}
                                    >
                                        <View className="flex-1 mr-3">
                                            {/* Key + status row */}
                                            <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                                                {hasJiraKey ? (
                                                    <View className="bg-[#0052CC]/20 px-1.5 py-0.5 rounded">
                                                        <Text className="text-[#4C9AFF] text-[10px] font-bold font-mono">
                                                            {task.key}
                                                        </Text>
                                                    </View>
                                                ) : group?.jira_project_key ? (
                                                    <View className="bg-[#F59E0B]/20 px-1.5 py-0.5 rounded flex-row items-center gap-1">
                                                        <MaterialIcons name="sync-problem" size={10} color="#F59E0B" />
                                                        <Text className="text-[#F59E0B] text-[10px] font-semibold">
                                                            Chưa sync
                                                        </Text>
                                                    </View>
                                                ) : null}
                                                <View
                                                    className="px-2 py-0.5 rounded-md"
                                                    style={{ backgroundColor: cfg.color + '25' }}
                                                >
                                                    <Text className="text-[10px] font-bold" style={{ color: cfg.color }}>
                                                        {cfg.label}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text className="text-white text-sm font-medium" numberOfLines={1}>
                                                {task.title}
                                            </Text>
                                            <View className="flex-row items-center gap-1.5 mt-1">
                                                <MaterialIcons
                                                    name="person"
                                                    size={11}
                                                    color={task.assignee_name ? '#60A5FA' : '#475569'}
                                                />
                                                <Text
                                                    className={`text-[11px] ${task.assignee_name ? 'text-blue-400' : 'text-gray-600'}`}
                                                    numberOfLines={1}
                                                >
                                                    {task.assignee_name || 'Unassigned'}
                                                </Text>
                                            </View>
                                        </View>
                                        {isLeader && (
                                            <View className="gap-1">
                                                {/* Quick move — label changes based on current status */}
                                                {task.status !== 'BLOCKED' && (
                                                    <TouchableOpacity
                                                        onPress={() => handleQuickMoveTask(task)}
                                                        className="w-8 h-8 rounded-lg bg-[#243447] items-center justify-center"
                                                        activeOpacity={0.8}
                                                    >
                                                        <Feather
                                                            name={task.status === 'DONE' ? 'rotate-ccw' : 'arrow-right'}
                                                            size={14}
                                                            color="#A78BFA"
                                                        />
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                    onPress={() => openEditTaskModal(task)}
                                                    className="w-8 h-8 rounded-lg bg-[#243447] items-center justify-center"
                                                    activeOpacity={0.8}
                                                >
                                                    <Feather name="edit-2" size={14} color="#93C5FD" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteTask(task)}
                                                    className="w-8 h-8 rounded-lg bg-[#243447] items-center justify-center"
                                                    activeOpacity={0.8}
                                                >
                                                    <Feather name="trash-2" size={14} color="#F87171" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        ) : (
                            <View className="mt-1 bg-[#243447] rounded-xl p-3 flex-row items-center gap-2">
                                <MaterialIcons name="info-outline" size={14} color="#64748B" />
                                <Text className="text-gray-500 text-xs flex-1">
                                    No tasks available for this group yet.
                                </Text>
                            </View>
                        )}

                        {crudEnabled && hasMoreTasks && (
                            <TouchableOpacity
                                onPress={handleLoadMoreTasks}
                                className="mt-4 bg-[#243447] rounded-xl py-2.5 items-center"
                                activeOpacity={0.8}
                                disabled={loadingMoreTasks}
                            >
                                {loadingMoreTasks ? (
                                    <ActivityIndicator size="small" color="#93C5FD" />
                                ) : (
                                    <Text className="text-[#93C5FD] text-xs font-semibold">Load more tasks</Text>
                                )}
                            </TouchableOpacity>
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

            <Modal
                visible={isTaskFormVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setTaskFormVisible(false)}
            >
                <View className="flex-1 bg-black/60 justify-end">
                    <ScrollView
                        className="bg-[#101922] rounded-t-3xl border-t border-white/10"
                        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View className="flex-row items-center justify-between mb-4">
                            <View>
                                <Text className="text-white text-lg font-bold">
                                    {editingTask ? 'Edit Task' : 'New Task'}
                                </Text>
                                {!!group?.jira_project_key && (
                                    <Text className="text-[#4C9AFF] text-[11px] mt-0.5">
                                        Will sync to Jira · {group.jira_project_key}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setTaskFormVisible(false)} className="p-2">
                                <Feather name="x" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Title */}
                        <Text className="text-gray-400 text-xs mb-1">Title *</Text>
                        <TextInput
                            value={formTitle}
                            onChangeText={setFormTitle}
                            placeholder="Task title"
                            placeholderTextColor="#64748B"
                            className="bg-[#1A2332] rounded-xl px-4 h-11 text-white text-sm mb-3"
                        />

                        {/* Description */}
                        <Text className="text-gray-400 text-xs mb-1">Description</Text>
                        <TextInput
                            value={formDescription}
                            onChangeText={setFormDescription}
                            placeholder="Task details"
                            placeholderTextColor="#64748B"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            className="bg-[#1A2332] rounded-xl px-4 py-3 text-white text-sm min-h-[72px] mb-3"
                        />

                        {/* Assignee picker */}
                        <Text className="text-gray-400 text-xs mb-2">
                            Assign to
                            {!editingTask && (
                                <Text className="text-gray-600"> · status auto-set by assignee</Text>
                            )}
                        </Text>
                        <View className="flex-row flex-wrap gap-2 mb-3">
                            {/* Unassign option */}
                            <TouchableOpacity
                                onPress={() => setFormAssigneeId(null)}
                                className={`px-3 py-2 rounded-lg border ${!formAssigneeId ? 'border-slate-400 bg-slate-400/15' : 'border-white/10 bg-[#1A2332]'}`}
                                activeOpacity={0.8}
                            >
                                <Text className={`text-xs font-semibold ${!formAssigneeId ? 'text-slate-300' : 'text-gray-500'}`}>
                                    None
                                </Text>
                            </TouchableOpacity>
                            {group?.members.map((m) => {
                                const selected = formAssigneeId === m.id;
                                return (
                                    <TouchableOpacity
                                        key={m.id}
                                        onPress={() => setFormAssigneeId(m.id)}
                                        className={`px-3 py-2 rounded-lg border flex-row items-center gap-1.5 ${selected ? 'border-[#4C9AFF] bg-[#4C9AFF]/20' : 'border-white/10 bg-[#1A2332]'}`}
                                        activeOpacity={0.8}
                                    >
                                        <View className="w-4 h-4 rounded-full bg-[#243447] items-center justify-center">
                                            <Text className="text-[8px] text-white font-bold">
                                                {m.full_name?.charAt(0)?.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text className={`text-xs font-semibold ${selected ? 'text-[#93C5FD]' : 'text-gray-300'}`} numberOfLines={1}>
                                            {m.full_name?.split(' ').pop()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Status — edit only, create is controlled by BE */}
                        {!!editingTask && (
                            <>
                                <Text className="text-gray-400 text-xs mb-2">Status</Text>
                                <View className="flex-row gap-2 mb-3">
                                    {EDIT_STATUS_OPTIONS.map((s: TaskStatus) => (
                                        <TouchableOpacity
                                            key={s}
                                            onPress={() => setFormStatus(s)}
                                            className={`flex-1 py-2 rounded-lg border items-center ${formStatus === s ? 'border-[#4C9AFF] bg-[#4C9AFF]/20' : 'border-white/10 bg-[#1A2332]'}`}
                                            activeOpacity={0.8}
                                        >
                                            <Text className={`text-xs font-semibold ${formStatus === s ? 'text-[#93C5FD]' : 'text-gray-300'}`}>
                                                {s.replace('_', ' ')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        {/* Priority */}
                        <Text className="text-gray-400 text-xs mb-2">Priority</Text>
                        <View className="flex-row flex-wrap gap-2 mb-3">
                            {PRIORITY_OPTIONS.map((priority) => (
                                <TouchableOpacity
                                    key={priority}
                                    onPress={() => setFormPriority(priority)}
                                    className={`px-3 py-2 rounded-lg border ${formPriority === priority ? 'border-[#4C9AFF] bg-[#4C9AFF]/20' : 'border-white/10 bg-[#1A2332]'}`}
                                    activeOpacity={0.8}
                                >
                                    <Text className={`text-xs font-semibold ${formPriority === priority ? 'text-[#93C5FD]' : 'text-gray-300'}`}>
                                        {priority}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Due Date */}
                        <Text className="text-gray-400 text-xs mb-1">Due Date (YYYY-MM-DD)</Text>
                        <TextInput
                            value={formDueDate}
                            onChangeText={setFormDueDate}
                            placeholder="2026-03-25"
                            placeholderTextColor="#64748B"
                            className="bg-[#1A2332] rounded-xl px-4 h-11 text-white text-sm mb-5"
                        />

                        <TouchableOpacity
                            onPress={handleSaveTask}
                            disabled={savingTask}
                            className={`rounded-xl py-3.5 items-center flex-row justify-center gap-2 ${savingTask ? 'bg-[#334155]' : 'bg-[#2563EB]'}`}
                            activeOpacity={0.8}
                        >
                            {savingTask ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Feather name={editingTask ? 'save' : 'plus'} size={16} color="#fff" />
                                    <Text className="text-white font-semibold">
                                        {editingTask ? 'Save Changes' : 'Create Task'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>

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
