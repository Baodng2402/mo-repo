import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StatusBar,
    TextInput,
    RefreshControl,
    ActivityIndicator,
    InteractionManager,
    Modal,
    Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getAllClasses, getMyClasses, joinClass } from '@/services/classService';
import { showError, showSuccess } from '@/utils/toast';
import type { ClassItem, ClassStatus } from '@/types/class';
import type { RootStackParamList } from '@/navigation/AppNavigator';

// ==================== Constants ====================

const TAB_BAR_HEIGHT = 80;

const STATUS_CONFIG: Record<ClassStatus, { label: string; color: string; bg: string }> = {
    ONGOING: { label: 'Ongoing', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    COMPLETED: { label: 'Completed', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    ARCHIVED: { label: 'Archived', color: '#EAB308', bg: 'rgba(234,179,8,0.15)' },
};

// ==================== Memoized Components ====================

const MyClassCard = React.memo(
    ({ item, onPress }: { item: ClassItem; onPress: (id: string) => void }) => {
        const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ONGOING;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPress(item.id)}
                className="bg-[#1A2332] rounded-2xl p-4 mb-3"
            >
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1.5">
                            <View
                                className="px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: statusCfg.bg }}
                            >
                                <Text
                                    className="text-[10px] font-semibold"
                                    style={{ color: statusCfg.color }}
                                >
                                    {statusCfg.label}
                                </Text>
                            </View>
                            {item.semester && (
                                <Text className="text-gray-500 text-xs">{item.semester}</Text>
                            )}
                        </View>
                        <Text className="text-white text-lg font-bold">{item.code}</Text>
                        <Text className="text-gray-400 text-sm mt-0.5">{item.name}</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#475569" />
                </View>
            </TouchableOpacity>
        );
    },
);

const BrowseClassCard = React.memo(
    ({
        item,
        onJoin,
        onPress,
    }: {
        item: ClassItem;
        onJoin: (item: ClassItem) => void;
        onPress: (id: string) => void;
    }) => {
        const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ONGOING;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPress(item.id)}
                className="bg-[#1A2332] rounded-2xl p-4 mb-3"
            >
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1.5">
                            <View
                                className="px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: statusCfg.bg }}
                            >
                                <Text
                                    className="text-[10px] font-semibold"
                                    style={{ color: statusCfg.color }}
                                >
                                    {statusCfg.label}
                                </Text>
                            </View>
                            {item.semester && (
                                <Text className="text-gray-500 text-xs">{item.semester}</Text>
                            )}
                        </View>
                        <Text className="text-white text-lg font-bold">{item.code}</Text>
                        <Text className="text-gray-400 text-sm mt-0.5">{item.name}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-white/5">
                    <View className="flex-row items-center gap-1.5">
                        <MaterialIcons name="groups" size={16} color="#64748B" />
                        <Text className="text-gray-400 text-xs">
                            Max {item.max_groups} groups · {item.max_students_per_group}/group
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => onJoin(item)}
                        activeOpacity={0.8}
                        className="bg-[#7C3AED] px-4 py-2 rounded-xl flex-row items-center gap-1.5"
                    >
                        <Feather name="log-in" size={14} color="#fff" />
                        <Text className="text-white text-xs font-semibold">Join</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    },
);

const EmptyState = React.memo(({ message }: { message: string }) => (
    <View className="items-center py-16">
        <MaterialIcons name="school" size={48} color="#64748B" />
        <Text className="text-gray-400 mt-3 text-base">{message}</Text>
    </View>
));

// ==================== Main Component ====================

const ClassesScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    // ── State ────────────────────────────────────────
    const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
    const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Join modal state
    const [joinModalVisible, setJoinModalVisible] = useState(false);
    const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
    const [enrollmentKey, setEnrollmentKey] = useState('');
    const [joining, setJoining] = useState(false);

    const isMounted = useRef(true);

    // ── Derived: filter out already-enrolled classes from browse list ──
    const myClassIds = useMemo(() => new Set(myClasses.map((c) => c.id)), [myClasses]);
    const browseClasses = useMemo(
        () => allClasses.filter((c) => !myClassIds.has(c.id)),
        [allClasses, myClassIds],
    );

    // ── Fetch ────────────────────────────────────────

    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setLoading(true);

            const [all, mine] = await Promise.all([getAllClasses(), getMyClasses()]);

            if (!isMounted.current) return;
            setAllClasses(all);
            setMyClasses(mine);
        } catch (error: any) {
            if (!isMounted.current) return;
            showError(error.response?.data?.message || 'Failed to load classes');
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            isMounted.current = true;
            const task = InteractionManager.runAfterInteractions(() => {
                fetchData();
            });
            return () => {
                isMounted.current = false;
                task.cancel();
            };
        }, [fetchData]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData(true);
    }, [fetchData]);

    // ── Join Class ───────────────────────────────────

    const openJoinModal = useCallback((classItem: ClassItem) => {
        setSelectedClass(classItem);
        setEnrollmentKey('');
        setJoinModalVisible(true);
    }, []);

    const handleJoinClass = useCallback(async () => {
        if (!selectedClass || !enrollmentKey.trim()) return;

        try {
            setJoining(true);
            await joinClass(selectedClass.id, { enrollment_key: enrollmentKey.trim() });
            showSuccess(`Joined ${selectedClass.code} successfully!`, 'Enrolled 🎉');
            setJoinModalVisible(false);
            fetchData(true);
            navigation.navigate('ClassDetail', { classId: selectedClass.id });
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to join class');
        } finally {
            setJoining(false);
        }
    }, [selectedClass, enrollmentKey, fetchData]);

    // ── Navigation ───────────────────────────────────

    const handleClassPress = useCallback(
        (classId: string) => {
            navigation.navigate('ClassDetail', { classId });
        },
        [navigation],
    );

    // ── FlatList Callbacks ───────────────────────────

    const renderBrowseClass = useCallback(
        ({ item }: { item: ClassItem }) => (
            <BrowseClassCard item={item} onJoin={openJoinModal} onPress={handleClassPress} />
        ),
        [openJoinModal, handleClassPress],
    );

    const keyExtractor = useCallback((item: ClassItem) => item.id, []);

    // ── List Header: My Classes Section ──────────────

    const ListHeader = useMemo(() => {
        if (myClasses.length === 0) return null;

        return (
            <View className="mb-5">
                <Text className="text-white text-lg font-semibold mb-3">My Classes</Text>
                {myClasses.map((item) => (
                    <MyClassCard key={item.id} item={item} onPress={handleClassPress} />
                ))}
                <Text className="text-gray-600 text-xs font-semibold mt-4 mb-2 ml-1">
                    BROWSE CLASSES
                </Text>
            </View>
        );
    }, [myClasses, handleClassPress]);

    // ── Main Render ──────────────────────────────────

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <View className="px-4 py-3">
                <Text className="text-white text-2xl font-bold">Classes</Text>
                <Text className="text-gray-400 text-sm mt-0.5">
                    {myClasses.length > 0
                        ? `${myClasses.length} enrolled · Browse & join more`
                        : 'Browse & join a class'}
                </Text>
            </View>

            {/* Content */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#7C3AED" />
                </View>
            ) : (
                <FlatList
                    data={browseClasses}
                    renderItem={renderBrowseClass}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
                    }}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={8}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#7C3AED"
                            colors={['#7C3AED']}
                        />
                    }
                    ListHeaderComponent={ListHeader}
                    ListEmptyComponent={
                        <EmptyState
                            message={
                                myClasses.length > 0
                                    ? 'No more classes to join'
                                    : 'No classes available'
                            }
                        />
                    }
                />
            )}

            {/* ═══════ Join Class Modal ═══════ */}
            <Modal
                visible={joinModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setJoinModalVisible(false)}
            >
                <Pressable
                    onPress={() => setJoinModalVisible(false)}
                    className="flex-1 bg-black/60 items-center justify-center px-8"
                >
                    <Pressable onPress={() => { }} className="bg-[#1A2332] rounded-2xl w-full p-6">
                        {/* Icon */}
                        <View className="items-center mb-4">
                            <View className="w-16 h-16 rounded-full items-center justify-center bg-[#7C3AED]/20">
                                <Feather name="key" size={28} color="#7C3AED" />
                            </View>
                        </View>

                        <Text className="text-white text-xl font-bold text-center mb-1">
                            Join {selectedClass?.code}
                        </Text>
                        <Text className="text-gray-400 text-sm text-center mb-6">
                            Enter the enrollment key provided by your lecturer
                        </Text>

                        {/* Input */}
                        <TextInput
                            value={enrollmentKey}
                            onChangeText={setEnrollmentKey}
                            placeholder="e.g. RANDOM-KEY-123"
                            placeholderTextColor="#475569"
                            autoCapitalize="characters"
                            className="bg-[#101922] rounded-xl px-4 h-12 text-white text-sm border border-white/10 mb-5 text-center tracking-widest font-mono"
                        />

                        {/* Buttons */}
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setJoinModalVisible(false)}
                                activeOpacity={0.8}
                                className="flex-1 bg-white/5 rounded-xl py-3.5 items-center"
                            >
                                <Text className="text-white font-semibold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleJoinClass}
                                disabled={joining || !enrollmentKey.trim()}
                                activeOpacity={0.8}
                                className={`flex-1 rounded-xl py-3.5 items-center ${joining || !enrollmentKey.trim()
                                    ? 'bg-[#334155]'
                                    : 'bg-[#7C3AED]'
                                    }`}
                            >
                                {joining ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text className="text-white font-semibold">Join</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

export default ClassesScreen;
