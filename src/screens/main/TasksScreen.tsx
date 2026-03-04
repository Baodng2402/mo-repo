import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StatusBar,
    InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// ==================== Types ====================

type TaskStatus = 'todo' | 'inProgress' | 'done';

interface Task {
    id: number;
    title: string;
    priority: string;
    assignee: string;
    deadline: string;
}

// ==================== Constants ====================

const MOCK_TASKS: Record<TaskStatus, Task[]> = {
    todo: [
        { id: 1, title: 'Setup CI/CD Pipeline', priority: 'medium', assignee: 'https://i.pravatar.cc/150?img=1', deadline: '2026-02-10' },
        { id: 2, title: 'Write API documentation', priority: 'low', assignee: 'https://i.pravatar.cc/150?img=2', deadline: '2026-02-12' },
    ],
    inProgress: [
        { id: 3, title: 'Implement User Auth', priority: 'high', assignee: 'https://i.pravatar.cc/150?img=3', deadline: '2026-02-05' },
        { id: 4, title: 'Design Dashboard UI', priority: 'medium', assignee: 'https://i.pravatar.cc/150?img=4', deadline: '2026-02-07' },
        { id: 5, title: 'Create database schema', priority: 'high', assignee: 'https://i.pravatar.cc/150?img=5', deadline: '2026-02-06' },
    ],
    done: [
        { id: 6, title: 'Project setup', priority: 'high', assignee: 'https://i.pravatar.cc/150?img=6', deadline: '2026-01-28' },
        { id: 7, title: 'Team formation', priority: 'high', assignee: 'https://i.pravatar.cc/150?img=7', deadline: '2026-01-25' },
        { id: 8, title: 'Requirements analysis', priority: 'medium', assignee: 'https://i.pravatar.cc/150?img=8', deadline: '2026-01-30' },
    ],
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
    ({ task, isDone }: { task: Task; isDone: boolean }) => {
        const getPriorityStyle = (priority: string) => {
            switch (priority) {
                case 'high': return { dot: '#EF4444', text: 'text-red-400' };
                case 'medium': return { dot: '#EAB308', text: 'text-yellow-400' };
                default: return { dot: '#22C55E', text: 'text-green-400' };
            }
        };

        const getDeadlineText = (deadline: string) => {
            const today = new Date();
            const deadlineDate = new Date(deadline);
            const diffDays = Math.ceil(
                (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (diffDays < 0) return { text: 'Overdue', color: '#EF4444' };
            if (diffDays <= 2) return { text: `${diffDays}d`, color: '#EAB308' };
            return { text: `${diffDays}d`, color: '#94A3B8' };
        };

        const priority = getPriorityStyle(task.priority);
        const deadline = getDeadlineText(task.deadline);

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                className={`bg-[#1A2332] rounded-xl p-3 mb-2 flex-row items-center ${isDone ? 'opacity-60' : ''
                    }`}
            >
                {/* Checkbox */}
                <TouchableOpacity
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${isDone
                            ? 'border-green-500 bg-green-500'
                            : 'border-white/15 bg-transparent'
                        }`}
                >
                    {isDone && <Feather name="check" size={14} color="#fff" />}
                </TouchableOpacity>

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
                        {!isDone && (
                            <View className="flex-row items-center gap-1">
                                <Feather name="clock" size={10} color={deadline.color} />
                                <Text
                                    className="text-[10px] font-medium"
                                    style={{ color: deadline.color }}
                                >
                                    {deadline.text}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Assignee */}
                <Image source={{ uri: task.assignee }} className="w-7 h-7 rounded-full ml-2" />
            </TouchableOpacity>
        );
    },
);

// ==================== Main Component ====================

const TasksScreen = () => {
    const insets = useSafeAreaInsets();
    const [activeColumn, setActiveColumn] = useState<TaskStatus>('inProgress');
    const [ready, setReady] = useState(false);

    /** Defer render until after navigation animation */
    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                setReady(true);
            });
            return () => {
                task.cancel();
            };
        }, []),
    );

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* ── Header ── */}
            <View className="px-4 py-3">
                <Text className="text-white text-2xl font-bold">My Tasks</Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                    {MOCK_TASKS.inProgress.length} in progress • {MOCK_TASKS.todo.length} pending
                </Text>
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
                                        {MOCK_TASKS[column.key].length}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ── Tasks List ── */}
            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >
                {ready &&
                    MOCK_TASKS[activeColumn].map((task) => (
                        <TaskCard key={task.id} task={task} isDone={activeColumn === 'done'} />
                    ))}

                {MOCK_TASKS[activeColumn].length === 0 && (
                    <View className="items-center py-16">
                        <MaterialIcons name="task" size={48} color="#475569" />
                        <Text className="text-gray-500 mt-3">No tasks here</Text>
                    </View>
                )}
            </ScrollView>

            {/* ── FAB — positioned above tab bar using safe area insets ── */}
            <TouchableOpacity
                activeOpacity={0.9}
                style={{
                    position: 'absolute',
                    right: 20,
                    bottom: TAB_BAR_HEIGHT + insets.bottom + 16,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#7C3AED',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#7C3AED',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8,
                }}
            >
                <Feather name="plus" size={26} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default TasksScreen;
