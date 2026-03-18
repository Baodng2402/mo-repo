import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    RefreshControl,
    Animated,
    InteractionManager,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useUserStore } from '@/utils/stores/userStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getMyAssignmentFeed, getMyPrimaryGroup } from '@/services/studentService';
import { getNotifications } from '@/services/notificationService';
import { showError } from '@/utils/toast';
import type { AssignmentItem } from '@/services/reportService';
import type { Group } from '@/types/group';

// ==================== Constants ====================

const normalizeStatus = (status: string): 'todo' | 'inProgress' | 'done' => {
    const s = status.toUpperCase();
    if (s.includes('DONE')) return 'done';
    if (s.includes('PROGRESS') || s.includes('IN_')) return 'inProgress';
    return 'todo';
};

// ==================== Memoized Components ====================

/** Single stat card */
const StatCard = React.memo(({ stat }: { stat: { label: string; value: number; icon: string; color: string } }) => (
    <TouchableOpacity className="flex-1 bg-[#1A2332] rounded-2xl p-3" activeOpacity={0.8}>
        <View
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: stat.color + '20' }}
        >
            <Feather name={stat.icon as any} size={18} color={stat.color} />
        </View>
        <Text className="text-white text-2xl font-bold mt-2">{stat.value}</Text>
        <Text className="text-gray-500 text-xs mt-0.5">{stat.label}</Text>
    </TouchableOpacity>
));

/** Single task row */
const TaskRow = React.memo(({ task }: { task: AssignmentItem }) => {
    const getPriorityStyle = (priority: string) => {
        const p = priority.toUpperCase();
        switch (p) {
            case 'HIGH':
            case 'CRITICAL':
                return { bg: 'bg-red-500/15', text: 'text-red-400', border: '#EF4444' };
            case 'MEDIUM':
                return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: '#EAB308' };
            default:
                return { bg: 'bg-green-500/15', text: 'text-green-400', border: '#22C55E' };
        }
    };

    const priority = getPriorityStyle(task.priority);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            className="bg-[#1A2332] rounded-2xl p-3 mb-2 flex-row items-center"
        >
            <View
                className="w-1 h-10 rounded-sm mr-3"
                style={{ backgroundColor: priority.border }}
            />
            <View className="flex-1">
                <Text className="text-white text-sm font-medium" numberOfLines={1}>
                    {task.title}
                </Text>
                <View className="flex-row items-center gap-2 mt-1.5">
                    <View className={`px-2 py-0.5 rounded-md ${priority.bg}`}>
                        <Text className={`text-[10px] font-semibold capitalize ${priority.text}`}>
                            {task.priority}
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                        <Feather name="hash" size={11} color="#64748B" />
                        <Text className="text-xs font-medium text-gray-400">
                            {task.key}
                        </Text>
                    </View>
                </View>
            </View>
            <View className="ml-2 px-2 py-1 rounded-md bg-[#243447]">
                <Text className="text-[10px] text-[#A78BFA]" numberOfLines={1}>
                    {task.assignee || 'Unassigned'}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

// ==================== Main Component ====================

const DashboardScreen = () => {
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [myGroup, setMyGroup] = useState<Group | null>(null);
    const [myTasks, setMyTasks] = useState<AssignmentItem[]>([]);
    const [stats, setStats] = useState([
        { label: 'In Progress', value: 0, icon: 'clock', color: '#EAB308' },
        { label: 'Completed', value: 0, icon: 'check-circle', color: '#22C55E' },
        { label: 'To Do', value: 0, icon: 'alert-circle', color: '#EF4444' },
    ]);
    const [unreadCount, setUnreadCount] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const userInfo = useUserStore((state) => state.userInfo);

    const fetchDashboard = useCallback(async () => {
        try {
            setLoading(true);

            const [group, assignmentFeed, notifications] = await Promise.all([
                getMyPrimaryGroup(),
                getMyAssignmentFeed(),
                getNotifications().catch(() => []),
            ]);

            setMyGroup(group);
            const tasks = assignmentFeed.assignments || [];
            setMyTasks(tasks.slice(0, 5));

            const counters = { todo: 0, inProgress: 0, done: 0 };
            for (const task of tasks) {
                counters[normalizeStatus(task.status)] += 1;
            }

            setStats([
                { label: 'In Progress', value: counters.inProgress, icon: 'clock', color: '#EAB308' },
                { label: 'Completed', value: counters.done, icon: 'check-circle', color: '#22C55E' },
                { label: 'To Do', value: counters.todo, icon: 'alert-circle', color: '#EF4444' },
            ]);
            setUnreadCount(notifications.filter((n) => !n.is_read).length);
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Defer entrance animation until navigation transition completes.
     * This prevents the JS thread from blocking the UI thread.
     */
    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(slideAnim, {
                        toValue: 0,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                ]).start();
                fetchDashboard();
            });

            return () => {
                task.cancel();
                fadeAnim.setValue(0);
                slideAnim.setValue(30);
            };
        }, [fadeAnim, slideAnim, fetchDashboard]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchDashboard();
        setRefreshing(false);
    }, [fetchDashboard]);

    /** Get first name for a casual Gen Z greeting */
    const firstName = userInfo?.fullName?.split(' ').pop() || 'bạn';

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* ── Header ── */}
            <Animated.View
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                className="px-4 py-3"
            >
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-gray-500 text-sm">Hey {firstName} 👋</Text>
                        <Text className="text-white text-2xl font-bold mt-0.5">Dashboard</Text>
                    </View>
                    <TouchableOpacity className="w-11 h-11 rounded-full bg-[#1A2332] items-center justify-center">
                        <Feather name="bell" size={20} color="#94A3B8" />
                        {unreadCount > 0 && (
                            <View className="absolute top-2.5 right-2.5 min-w-[16px] h-4 rounded-full bg-red-500 border border-[#1A2332] px-1 items-center justify-center">
                                <Text className="text-[9px] text-white font-bold">{Math.min(unreadCount, 99)}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#7C3AED"
                        colors={['#7C3AED']}
                    />
                }
            >
                {/* ── My Group Card ── */}
                <Animated.View
                    style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                    className="px-4 mt-3"
                >
                    <Text className="text-white text-lg font-semibold mb-3">My Group</Text>

                    {myGroup ? (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('GroupDetail', { groupId: myGroup.id })}
                            activeOpacity={0.9}
                            className="bg-[#1A2332] rounded-2xl p-4"
                        >
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-2">
                                        <View className="bg-[#7C3AED] px-2.5 py-1 rounded-lg">
                                            <Text className="text-white text-xs font-semibold">
                                                {myGroup.semester || 'SWP391'}
                                            </Text>
                                        </View>
                                        <Text className="text-green-400 text-xs font-medium">
                                            ● Active
                                        </Text>
                                    </View>
                                    <Text className="text-white text-xl font-bold mt-2">
                                        {myGroup.name}
                                    </Text>
                                    <Text className="text-gray-400 text-sm mt-0.5">
                                        {myGroup.project_name || 'No project name yet'}
                                    </Text>
                                </View>
                                <View className="items-center">
                                    <Text className="text-[#A78BFA] text-3xl font-bold">
                                        {stats[1].value + stats[0].value + stats[2].value > 0
                                            ? `${Math.round((stats[1].value / (stats[1].value + stats[0].value + stats[2].value)) * 100)}%`
                                            : '0%'}
                                    </Text>
                                    <Text className="text-gray-500 text-xs">Progress</Text>
                                </View>
                            </View>

                            {/* Progress Bar */}
                            <View className="mt-4">
                                <View className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <View
                                        className="h-full bg-[#7C3AED] rounded-full"
                                        style={{
                                            width: `${stats[1].value + stats[0].value + stats[2].value > 0
                                                ? Math.round((stats[1].value / (stats[1].value + stats[0].value + stats[2].value)) * 100)
                                                : 0}%`,
                                        }}
                                    />
                                </View>
                            </View>

                            {/* Members Row */}
                            <View className="flex-row justify-between items-center mt-4">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-full bg-[#243447] border-2 border-[#1A2332] items-center justify-center">
                                        <Text className="text-gray-400 text-xs font-semibold">
                                            {myGroup.members_count}
                                        </Text>
                                    </View>
                                    <Text className="text-gray-500 text-xs ml-2">
                                        {myGroup.members_count} members
                                    </Text>
                                </View>
                                <Feather name="chevron-right" size={20} color="#475569" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View className="bg-[#1A2332] rounded-2xl p-6 items-center border border-dashed border-white/10">
                            <MaterialIcons name="group-add" size={48} color="#475569" />
                            <Text className="text-gray-400 text-center mt-3 mb-4">
                                You haven't joined any group yet
                            </Text>
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('MainTabs' as never, { screen: 'Classes' } as never)
                                }
                                className="bg-[#7C3AED] px-6 py-3 rounded-xl"
                            >
                                <Text className="text-white font-semibold">Browse Groups</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>

                {/* ── Quick Stats ── */}
                <Animated.View style={{ opacity: fadeAnim }} className="px-4 mt-6">
                    <Text className="text-white text-lg font-semibold mb-3">Quick Stats</Text>
                    <View className="flex-row gap-3">
                        {stats.map((stat, index) => (
                            <StatCard key={index} stat={stat} />
                        ))}
                    </View>
                </Animated.View>

                {/* ── My Tasks ── */}
                <Animated.View style={{ opacity: fadeAnim }} className="px-4 mt-6">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-white text-lg font-semibold">My Tasks</Text>
                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate('MainTabs' as never, { screen: 'Tasks' } as never)
                            }
                            className="flex-row items-center gap-1"
                        >
                            <Text className="text-[#A78BFA] text-sm font-medium">See all</Text>
                            <Feather name="arrow-right" size={14} color="#A78BFA" />
                        </TouchableOpacity>
                    </View>

                    {myTasks.length > 0 ? (
                        myTasks.map((task) => (
                            <TaskRow key={task.key} task={task} />
                        ))
                    ) : (
                        <View className="bg-[#1A2332] rounded-2xl p-4 items-center">
                            <Text className="text-gray-500">No tasks found for your group</Text>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default DashboardScreen;
