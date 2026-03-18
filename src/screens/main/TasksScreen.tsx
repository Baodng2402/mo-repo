import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StatusBar,
    InteractionManager,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMyAssignmentFeed } from '@/services/studentService';
import { showError } from '@/utils/toast';
import type { AssignmentItem } from '@/services/reportService';

// ==================== Types ====================

type TaskStatus = 'todo' | 'inProgress' | 'done';

// ==================== Constants ====================

const normalizeStatus = (status: string): TaskStatus => {
    const s = status.toUpperCase();
    if (s.includes('DONE')) return 'done';
    if (s.includes('PROGRESS') || s.includes('IN_')) return 'inProgress';
    return 'todo';
};

const COLUMNS: { key: TaskStatus; title: string; icon: string; color: string }[] = [
    { key: 'todo', title: 'To Do', icon: 'circle', color: '#64748B' },
    { key: 'inProgress', title: 'Progress', icon: 'clock', color: '#EAB308' },
    { key: 'done', title: 'Done', icon: 'check-circle', color: '#22C55E' },
];

/** Tab bar height including padding (approx) */
const TAB_BAR_HEIGHT = 80;

// ==================== Memoized Components ====================

/** Single task card with checkbox, priority dot, and deadline */
const TaskCard = React.memo(
    ({ task, isDone }: { task: AssignmentItem; isDone: boolean }) => {
        const getPriorityStyle = (priority: string) => {
            const p = priority.toUpperCase();
            switch (p) {
                case 'HIGH':
                case 'HIGHEST':
                case 'CRITICAL':
                    return { dot: '#EF4444', text: 'text-red-400' };
                case 'MEDIUM':
                    return { dot: '#EAB308', text: 'text-yellow-400' };
                default:
                    return { dot: '#22C55E', text: 'text-green-400' };
            }
        };

        const priority = getPriorityStyle(task.priority);

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                className={`bg-[#1A2332] rounded-xl p-3 mb-2 flex-row items-center ${isDone ? 'opacity-60' : ''
                    }`}
            >
                {/* Checkbox */}
                <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${isDone
                            ? 'border-green-500 bg-green-500'
                            : 'border-white/15 bg-transparent'
                        }`}
                >
                    {isDone && <Feather name="check" size={14} color="#fff" />}
                </View>

                {/* Content */}
                <View className="flex-1">
                    <Text
                        className={`text-sm font-medium ${isDone ? 'text-gray-500 line-through' : 'text-white'
                            }`}
                        numberOfLines={1}
                    >
                        {task.title}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1.5">
                        <View className="flex-row items-center gap-1">
                            <View
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: priority.dot }}
                            />
                            <Text
                                className={`text-[10px] font-medium capitalize ${priority.text}`}
                            >
                                {task.priority}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            <Text className="text-[10px] text-gray-500">#{task.key}</Text>
                        </View>
                    </View>
                </View>

                {/* Assignee */}
                <View className="ml-2 px-2 py-1 rounded-md bg-[#243447]">
                    <Text className="text-[10px] text-[#A78BFA]" numberOfLines={1}>
                        {task.assignee || 'Unassigned'}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    },
);

// ==================== Main Component ====================

const TasksScreen = () => {
    const insets = useSafeAreaInsets();
    const [activeColumn, setActiveColumn] = useState<TaskStatus>('inProgress');
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [groupName, setGroupName] = useState<string>('');
    const [taskMap, setTaskMap] = useState<Record<TaskStatus, AssignmentItem[]>>({
        todo: [],
        inProgress: [],
        done: [],
    });

    const fetchTasks = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setLoading(true);
            const res = await getMyAssignmentFeed();
            setGroupName(res.group?.name || '');

            const mapped: Record<TaskStatus, AssignmentItem[]> = {
                todo: [],
                inProgress: [],
                done: [],
            };

            for (const task of res.assignments) {
                mapped[normalizeStatus(task.status)].push(task);
            }

            setTaskMap(mapped);
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to load tasks');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    /** Defer render until after navigation animation */
    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                setReady(true);
                fetchTasks();
            });
            return () => {
                task.cancel();
            };
        }, [fetchTasks]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchTasks(true);
    }, [fetchTasks]);

    const tasks = taskMap[activeColumn];

    if (loading && !ready) {
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
            <View className="px-4 py-3">
                <Text className="text-white text-2xl font-bold">My Tasks</Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                    {taskMap.inProgress.length} in progress • {taskMap.todo.length} pending
                </Text>
                {!!groupName && (
                    <Text className="text-[#A78BFA] text-xs mt-1">Group: {groupName}</Text>
                )}
            </View>

            {/* ── Column Tabs ── */}
            <View className="px-4 mb-3">
                <View className="flex-row bg-[#1A2332] rounded-xl p-1 gap-1">
                    {COLUMNS.map((column) => {
                        const isActive = activeColumn === column.key;
                        return (
                            <TouchableOpacity
                                key={column.key}
                                onPress={() => setActiveColumn(column.key)}
                                className="flex-1 rounded-lg py-3 items-center flex-row justify-center gap-1.5"
                                style={isActive ? { backgroundColor: column.color } : {}}
                                activeOpacity={0.8}
                            >
                                <Feather
                                    name={column.icon as any}
                                    size={14}
                                    color={isActive ? '#fff' : '#475569'}
                                />
                                <Text
                                    className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-500'
                                        }`}
                                >
                                    {column.title}
                                </Text>
                                <View
                                    className={`px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20' : 'bg-white/5'
                                        }`}
                                >
                                    <Text
                                        className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-gray-500'
                                            }`}
                                    >
                                        {taskMap[column.key].length}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ── Tasks List ── */}
            <FlatList
                data={ready ? tasks : []}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => (
                    <View className="px-4">
                        <TaskCard task={item} isDone={activeColumn === 'done'} />
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#7C3AED"
                        colors={['#7C3AED']}
                    />
                }
                ListEmptyComponent={
                    <View className="items-center py-16">
                        <MaterialIcons name="task" size={48} color="#475569" />
                        <Text className="text-gray-500 mt-3">No tasks here</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

export default TasksScreen;
