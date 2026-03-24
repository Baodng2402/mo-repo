import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    InteractionManager,
    Linking,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showError, showInfo } from '@/utils/toast';
import { useUserStore } from '@/utils/stores/userStore';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getMyGroups } from '@/services/studentService';
import { getNotifications } from '@/services/notificationService';
import { getJiraProjects } from '@/services/jiraService';
import { getTasks, type TaskItem } from '@/services/taskService';
import type { Group } from '@/types/group';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
    TO_DO: '#64748B',
    IN_PROGRESS: '#0EA5E9',
    DONE: '#22C55E',
    BLOCKED: '#EF4444',
};

const STATUS_LABEL: Record<string, string> = {
    TO_DO: 'To Do',
    IN_PROGRESS: 'In Progress',
    DONE: 'Done',
    BLOCKED: 'Blocked',
};

const PRIORITY_COLOR: Record<string, string> = {
    LOW: '#64748B',
    MEDIUM: '#F59E0B',
    HIGH: '#F97316',
    CRITICAL: '#EF4444',
};

const getValidJiraSiteOrigin = (rawUrl?: string | null): string | null => {
    if (!rawUrl) return null;

    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();
        if (!host.endsWith('.atlassian.net')) {
            return null;
        }

        return parsed.origin;
    } catch {
        return null;
    }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const GroupCard = React.memo(
    ({
        group,
        isActive,
        onOpen,
        onOpenJira,
    }: {
        group: Group;
        isActive: boolean;
        onOpen: () => void;
        onOpenJira: () => void;
    }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onOpen}
            className={`rounded-3xl p-4 mr-3 ${isActive ? 'bg-[#21334A]' : 'bg-[#1A2332]'}`}
            style={{ width: Math.min(Dimensions.get('window').width - 48, 320) }}
        >
            <View className="flex-row items-center justify-between">
                <View className="bg-[#0EA5E9]/20 px-2.5 py-1 rounded-lg">
                    <Text className="text-[#7DD3FC] text-xs font-semibold">
                        {group.semester || 'Current Semester'}
                    </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                    <View
                        className={`w-2 h-2 rounded-full ${group.status === 'ACTIVE' ? 'bg-green-400' : 'bg-slate-500'}`}
                    />
                    <Text
                        className={`text-xs ${group.status === 'ACTIVE' ? 'text-green-300' : 'text-slate-400'}`}
                    >
                        {group.status === 'ACTIVE' ? 'Active' : group.status}
                    </Text>
                </View>
            </View>

            <Text className="text-white text-xl font-bold mt-3" numberOfLines={1}>
                {group.name}
            </Text>
            <Text className="text-[#CBD5E1] text-sm mt-1" numberOfLines={1}>
                {group.project_name || 'No project title yet'}
            </Text>

            <View className="flex-row items-center justify-between mt-4">
                <View className="flex-row items-center gap-2">
                    <MaterialIcons name="people" size={14} color="#94A3B8" />
                    <Text className="text-[#94A3B8] text-xs">{group.members_count} members</Text>
                </View>
                <View className="flex-row items-center gap-2">
                    {!!group.jira_project_key && (
                        <TouchableOpacity
                            className="bg-[#1D4ED8]/30 rounded-lg px-2 py-0.5"
                            activeOpacity={0.8}
                            onPress={(event) => {
                                event.stopPropagation();
                                onOpenJira();
                            }}
                        >
                            <Text className="text-[#93C5FD] text-[10px] font-semibold">
                                JIRA · {group.jira_project_key}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {!!group.github_repo_url && (
                        <View className="bg-white/10 rounded-lg px-2 py-0.5">
                            <Text className="text-slate-300 text-[10px] font-semibold">GitHub</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    ),
);

const StatChip = ({
    label,
    count,
    color,
}: {
    label: string;
    count: number;
    color: string;
}) => (
    <View className="flex-1 items-center bg-[#0F172A] rounded-xl py-3 px-2">
        <Text className="text-white text-xl font-black">{count}</Text>
        <View className="flex-row items-center gap-1 mt-1">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <Text className="text-slate-400 text-[10px] font-medium">{label}</Text>
        </View>
    </View>
);

const TaskRow = ({
    task,
    onPress,
}: {
    task: TaskItem;
    onPress: () => void;
}) => {
    const now = new Date();
    const dueDate = task.due_at ? new Date(task.due_at) : null;
    const isOverdue = dueDate && dueDate < now && task.status !== 'DONE';
    const isDueSoon =
        dueDate &&
        !isOverdue &&
        dueDate.getTime() - now.getTime() < 48 * 60 * 60 * 1000 &&
        task.status !== 'DONE';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            className="flex-row items-center gap-3 py-3 border-b border-white/5"
        >
            {/* Priority bar */}
            <View
                className="w-1 h-10 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] ?? '#64748B' }}
            />

            <View className="flex-1">
                <Text
                    className="text-white text-sm font-semibold"
                    numberOfLines={1}
                >
                    {task.title}
                </Text>
                {dueDate && (
                    <Text
                        className={`text-xs mt-0.5 ${isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-slate-500'}`}
                    >
                        {isOverdue ? '⚠ Overdue · ' : isDueSoon ? '⏰ Due soon · ' : ''}
                        {dueDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </Text>
                )}
            </View>

            {/* Status chip */}
            <View
                className="px-2 py-0.5 rounded-md"
                style={{ backgroundColor: (STATUS_COLOR[task.status] ?? '#64748B') + '30' }}
            >
                <Text
                    className="text-[10px] font-bold"
                    style={{ color: STATUS_COLOR[task.status] ?? '#64748B' }}
                >
                    {STATUS_LABEL[task.status] ?? task.status}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

const DashboardScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const userInfo = useUserStore((state) => state.userInfo);
    const [groups, setGroups] = useState<Group[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [groupTasks, setGroupTasks] = useState<TaskItem[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasBootstrapped, setHasBootstrapped] = useState(false);
    const [jiraSiteByKey, setJiraSiteByKey] = useState<Record<string, string>>({});

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    const displayName =
        userInfo?.fullName ||
        ((userInfo as unknown as { full_name?: string } | null)?.full_name ?? '');
    const firstName = displayName.trim().split(/\s+/).pop() || 'bạn';
    const cardWidth = Math.min(Dimensions.get('window').width - 48, 320);

    const activeGroup = groups[activeIndex] ?? null;

    // ── Task stats derived from groupTasks ──
    const todoCount = groupTasks.filter((t) => t.status === 'TO_DO').length;
    const inProgressCount = groupTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const doneCount = groupTasks.filter((t) => t.status === 'DONE').length;
    const totalCount = groupTasks.length;
    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    // ── My tasks: assigned to current user, not done, sorted by due_at ──
    const myTasks = groupTasks
        .filter((t) => t.status !== 'DONE')
        .sort((a, b) => {
            if (!a.due_at && !b.due_at) return 0;
            if (!a.due_at) return 1;
            if (!b.due_at) return -1;
            return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        })
        .slice(0, 4);

    const loadTasksForGroup = useCallback(async (groupId: string) => {
        setTasksLoading(true);
        try {
            const tasks = await getTasks({ group_id: groupId, limit: 100 });
            setGroupTasks(tasks);
        } catch {
            setGroupTasks([]);
        } finally {
            setTasksLoading(false);
        }
    }, []);

    const loadData = useCallback(
        async (options?: { silent?: boolean }) => {
            const shouldBlock = !options?.silent || !hasBootstrapped;
            try {
                if (shouldBlock) setLoading(true);

                const [allGroups, notifications] = await Promise.all([
                    getMyGroups(),
                    getNotifications().catch(() => []),
                ]);

                setGroups(allGroups);
                setUnreadCount(notifications.filter((n) => !n.is_read).length);

                const groupProjectKeys = allGroups
                    .map((group) => group.jira_project_key?.trim().toUpperCase())
                    .filter((key): key is string => !!key);

                if (groupProjectKeys.length > 0) {
                    getJiraProjects()
                        .then((projects) => {
                            const keySet = new Set(groupProjectKeys);
                            const nextSiteMap: Record<string, string> = {};

                            for (const project of projects) {
                                const key = project.key?.trim().toUpperCase();
                                if (!key || !keySet.has(key)) continue;

                                const siteOrigin =
                                    getValidJiraSiteOrigin(project.siteUrl) ||
                                    getValidJiraSiteOrigin(project.self);

                                if (siteOrigin) {
                                    nextSiteMap[key] = siteOrigin;
                                }
                            }

                            if (Object.keys(nextSiteMap).length > 0) {
                                setJiraSiteByKey((prev) => ({ ...prev, ...nextSiteMap }));
                            }
                        })
                        .catch(() => {
                            // Non-blocking: fallback URL still works.
                        });
                }

                if (allGroups.length === 0) {
                    setGroupTasks([]);
                    setActiveIndex(0);
                    return;
                }

                const currentIndex = Math.min(activeIndex, allGroups.length - 1);
                setActiveIndex(currentIndex);
                await loadTasksForGroup(allGroups[currentIndex].id);
            } catch (error: any) {
                showError(error?.response?.data?.message || 'Failed to load dashboard');
            } finally {
                if (shouldBlock) setLoading(false);
                if (!hasBootstrapped) setHasBootstrapped(true);
            }
        },
        [activeIndex, hasBootstrapped, loadTasksForGroup],
    );

    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
                ]).start();
                loadData({ silent: true });
            });
            return () => {
                task.cancel();
                fadeAnim.setValue(0);
                slideAnim.setValue(20);
            };
        }, [fadeAnim, slideAnim, loadData]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    const onGroupSliderEnd = useCallback(
        async (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const x = event.nativeEvent.contentOffset.x;
            const index = Math.round(x / (cardWidth + 12));
            if (index !== activeIndex && index >= 0 && index < groups.length) {
                setActiveIndex(index);
                await loadTasksForGroup(groups[index].id);
            }
        },
        [activeIndex, cardWidth, groups, loadTasksForGroup],
    );

    const openGroupDetail = useCallback(
        (groupId?: string) => {
            const id = groupId ?? activeGroup?.id;
            if (id) navigation.navigate('GroupDetail', { groupId: id });
        },
        [navigation, activeGroup],
    );

    const openJiraProject = useCallback(
        async (group: Group) => {
            const projectKey = group.jira_project_key?.trim();
            if (!projectKey) {
                showError('Jira project key is missing');
                return;
            }

            const normalizedKey = projectKey.toUpperCase();
            const jiraSiteUrl = getValidJiraSiteOrigin(jiraSiteByKey[normalizedKey]);
            const projectUrl = jiraSiteUrl
                ? `${jiraSiteUrl}/jira/software/projects/${encodeURIComponent(projectKey)}/summary`
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
                showInfo('Could not resolve project site, opened Atlassian home instead.');
            } catch {
                showError('Cannot open Jira URL');
            }
        },
        [jiraSiteByKey],
    );

    // ─── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
                <ActivityIndicator size="large" color="#0EA5E9" />
            </SafeAreaView>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <Animated.View
                className="px-4 pt-2 pb-1 flex-row items-center justify-between"
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            >
                <View>
                    <Text className="text-sky-300 text-sm">Xin chào, {firstName} 👋</Text>
                    <Text className="text-white text-2xl font-black mt-0.5">Team Board</Text>
                </View>
                <TouchableOpacity
                    className="w-11 h-11 rounded-full bg-[#1A2332] items-center justify-center"
                    // onPress={() => navigation.navigate('LinkedAccounts')}
                >
                    <Feather name="bell" size={20} color="#94A3B8" />
                    {unreadCount > 0 && (
                        <View className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full bg-red-500 px-1 items-center justify-center">
                            <Text className="text-[9px] text-white font-bold">
                                {Math.min(unreadCount, 99)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 110 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#0EA5E9"
                        colors={['#0EA5E9']}
                    />
                }
            >
                {/* ── Groups Carousel ─────────────────────────────────────── */}
                <Animated.View
                    className="mt-4"
                    style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                >
                    <View className="px-4 mb-3 flex-row items-center justify-between">
                        <Text className="text-white text-base font-bold">
                            Your Groups
                            {groups.length > 0 && (
                                <Text className="text-slate-500 font-normal"> · {groups.length}</Text>
                            )}
                        </Text>
                        {groups.length > 1 && (
                            <Text className="text-slate-400 text-xs">Swipe to switch</Text>
                        )}
                    </View>

                    {groups.length > 0 ? (
                        <>
                            <FlatList
                                horizontal
                                data={groups}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item, index }) => (
                                    <GroupCard
                                        group={item}
                                        isActive={index === activeIndex}
                                        onOpen={() => openGroupDetail(item.id)}
                                        onOpenJira={() => openJiraProject(item)}
                                    />
                                )}
                                snapToInterval={cardWidth + 12}
                                decelerationRate="fast"
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 16 }}
                                onMomentumScrollEnd={onGroupSliderEnd}
                            />

                            {/* Pagination dots */}
                            {groups.length > 1 && (
                                <View className="flex-row justify-center mt-3 gap-1.5">
                                    {groups.map((g, index) => (
                                        <View
                                            key={g.id}
                                            className={`rounded-full ${index === activeIndex ? 'bg-sky-400 w-5 h-2' : 'bg-slate-600 w-2 h-2'}`}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <View className="mx-4 bg-[#1A2332] rounded-2xl p-6 items-center border border-dashed border-white/10">
                            <MaterialIcons name="group-add" size={44} color="#475569" />
                            <Text className="text-gray-400 text-center mt-3 mb-4">
                                Bạn chưa tham gia nhóm nào
                            </Text>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('MainTabs')}
                                className="bg-sky-600 px-5 py-3 rounded-xl"
                            >
                                <Text className="text-white font-semibold">Khám phá nhóm</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>

                {/* ── Active Group Overview ────────────────────────────────── */}
                {!!activeGroup && (
                    <Animated.View className="px-4 mt-5" style={{ opacity: fadeAnim }}>
                        <View className="bg-[#13263B] rounded-2xl p-4 border border-[#1E3A5F]">
                            {/* Title row */}
                            <View className="flex-row items-start justify-between mb-3">
                                <View className="flex-1 pr-3">
                                    <Text className="text-sky-400 text-xs font-semibold uppercase tracking-wider">
                                        Active Group
                                    </Text>
                                    <Text
                                        className="text-white text-lg font-bold mt-0.5"
                                        numberOfLines={1}
                                    >
                                        {activeGroup.name}
                                    </Text>
                                    {!!activeGroup.project_name && (
                                        <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>
                                            {activeGroup.project_name}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity
                                    onPress={() => openGroupDetail()}
                                    className="bg-sky-600 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                                >
                                    <Text className="text-white text-xs font-semibold">Open</Text>
                                    <Feather name="arrow-right" size={12} color="white" />
                                </TouchableOpacity>
                            </View>

                            {/* Task progress bar */}
                            {tasksLoading ? (
                                <ActivityIndicator size="small" color="#0EA5E9" className="my-2" />
                            ) : totalCount > 0 ? (
                                <>
                                    <View className="flex-row items-center justify-between mb-1.5">
                                        <Text className="text-slate-400 text-xs">
                                            Task Progress
                                        </Text>
                                        <Text className="text-sky-300 text-xs font-bold">
                                            {doneCount}/{totalCount} done · {progressPct}%
                                        </Text>
                                    </View>
                                    <View className="h-2 bg-[#0F172A] rounded-full overflow-hidden mb-4">
                                        <View
                                            className="h-full bg-sky-500 rounded-full"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </View>

                                    {/* Stat chips */}
                                    <View className="flex-row gap-2">
                                        <StatChip label="To Do" count={todoCount} color="#64748B" />
                                        <StatChip
                                            label="In Progress"
                                            count={inProgressCount}
                                            color="#0EA5E9"
                                        />
                                        <StatChip label="Done" count={doneCount} color="#22C55E" />
                                    </View>
                                </>
                            ) : (
                                <View className="flex-row items-center gap-2 bg-[#0F172A] rounded-xl p-3">
                                    <MaterialIcons name="check-circle-outline" size={16} color="#475569" />
                                    <Text className="text-slate-500 text-xs">
                                        No tasks yet — open group to create the first one
                                    </Text>
                                </View>
                            )}

                            {/* Integration chips */}
                            {(!!activeGroup.jira_project_key || !!activeGroup.github_repo_url) && (
                                <View className="flex-row gap-2 mt-3 pt-3 border-t border-white/5">
                                    {!!activeGroup.jira_project_key && (
                                        <TouchableOpacity
                                            className="flex-row items-center gap-1.5 bg-[#1D4ED8]/20 rounded-lg px-3 py-2"
                                            activeOpacity={0.8}
                                            onPress={() => openJiraProject(activeGroup)}
                                        >
                                            <MaterialIcons name="link" size={12} color="#93C5FD" />
                                            <Text className="text-[#93C5FD] text-xs font-semibold">
                                                Jira · {activeGroup.jira_project_key}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    {!!activeGroup.github_repo_url && (
                                        <TouchableOpacity
                                            className="flex-row items-center gap-1.5 bg-white/10 rounded-lg px-3 py-2"
                                            onPress={() =>
                                                activeGroup.github_repo_url &&
                                                Linking.openURL(activeGroup.github_repo_url)
                                            }
                                        >
                                            <Feather name="github" size={12} color="#CBD5E1" />
                                            <Text className="text-slate-300 text-xs font-semibold">
                                                GitHub
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    </Animated.View>
                )}

                {/* ── My Tasks (assigned to me, not done) ─────────────────── */}
                {!!activeGroup && !tasksLoading && myTasks.length > 0 && (
                    <Animated.View className="px-4 mt-5" style={{ opacity: fadeAnim }}>
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-white text-base font-bold">My Tasks</Text>
                            <TouchableOpacity onPress={() => openGroupDetail()}>
                                <Text className="text-sky-400 text-xs font-semibold">View all →</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="bg-[#1A2332] rounded-2xl px-4 py-1 border border-[#243447]">
                            {myTasks.map((task) => (
                                <TaskRow
                                    key={task.id}
                                    task={task}
                                    onPress={() => openGroupDetail()}
                                />
                            ))}
                        </View>
                    </Animated.View>
                )}

                {/* ── Quick Actions ────────────────────────────────────────── */}
                {!!activeGroup && (
                    <Animated.View className="px-4 mt-5" style={{ opacity: fadeAnim }}>
                        <Text className="text-white text-base font-bold mb-3">Quick Access</Text>

                        <View className="flex-row gap-3">
                            {/* Reports */}
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('Reports', { groupId: activeGroup.id })
                                }
                                className="flex-1 bg-[#1A2332] rounded-2xl p-4 items-center border border-[#243447]"
                                activeOpacity={0.85}
                            >
                                <View className="w-10 h-10 rounded-xl bg-violet-500/20 items-center justify-center mb-2">
                                    <MaterialIcons name="assessment" size={20} color="#A78BFA" />
                                </View>
                                <Text className="text-white text-xs font-semibold">Reports</Text>
                            </TouchableOpacity>

                            {/* Documents */}
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('Documents', { groupId: activeGroup.id })
                                }
                                className="flex-1 bg-[#1A2332] rounded-2xl p-4 items-center border border-[#243447]"
                                activeOpacity={0.85}
                            >
                                <View className="w-10 h-10 rounded-xl bg-emerald-500/20 items-center justify-center mb-2">
                                    <MaterialIcons name="assignment" size={20} color="#6EE7B7" />
                                </View>
                                <Text className="text-white text-xs font-semibold">Documents</Text>
                            </TouchableOpacity>

                            {/* Topic Lab */}
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('TopicLab', { groupId: activeGroup.id })
                                }
                                className="flex-1 bg-[#1A2332] rounded-2xl p-4 items-center border border-[#243447]"
                                activeOpacity={0.85}
                            >
                                <View className="w-10 h-10 rounded-xl bg-amber-500/20 items-center justify-center mb-2">
                                    <MaterialIcons name="task" size={20} color="#FCD34D" />
                                </View>
                                <Text className="text-white text-xs font-semibold">Topic Lab</Text>
                            </TouchableOpacity>

                            {/* Evaluation */}
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('Evaluation', { groupId: activeGroup.id })
                                }
                                className="flex-1 bg-[#1A2332] rounded-2xl p-4 items-center border border-[#243447]"
                                activeOpacity={0.85}
                            >
                                <View className="w-10 h-10 rounded-xl bg-rose-500/20 items-center justify-center mb-2">
                                    <MaterialIcons name="star" size={20} color="#FDA4AF" />
                                </View>
                                <Text className="text-white text-xs font-semibold">Evaluation</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DashboardScreen;
