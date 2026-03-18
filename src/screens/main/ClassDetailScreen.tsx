import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    InteractionManager,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { getGroupsByClass, joinGroup } from '@/services/groupService';
import { showError, showSuccess } from '@/utils/toast';
import type { Group } from '@/types/group';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserStore } from '@/utils/stores/userStore';

// ==================== Types ====================

interface ClassGroup extends Group {
    members?: { user_id: string; full_name: string; role: string }[];
    topic?: { id: string; name: string } | null;
}

// ==================== Memoized Components ====================

const GroupCard = React.memo(
    ({
        item,
        onPress,
        onJoin,
        isMine,
    }: {
        item: ClassGroup;
        onPress: (id: string) => void;
        onJoin: (id: string, name: string) => void;
        isMine: boolean;
    }) => {
        const isEmpty = item.members_count === 0;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPress(item.id)}
                className="bg-[#1A2332] rounded-2xl p-4 mb-3"
            >
                {/* Header */}
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <Text className="text-white text-lg font-bold">{item.name}</Text>
                        {item.topic && (
                            <View className="flex-row items-center gap-1.5 mt-1">
                                <Feather name="book-open" size={12} color="#64748B" />
                                <Text className="text-gray-400 text-xs">{item.topic.name}</Text>
                            </View>
                        )}
                        {item.project_name && (
                            <Text className="text-gray-400 text-sm mt-0.5">
                                {item.project_name}
                            </Text>
                        )}
                    </View>
                    {isMine && (
                        <View className="bg-[#7C3AED]/20 px-2.5 py-1 rounded-lg">
                            <Text className="text-[#A78BFA] text-[10px] font-bold">Your Group</Text>
                        </View>
                    )}
                </View>

                {/* Members preview */}
                {(item.members?.length ?? 0) > 0 && (
                    <View className="mt-3 gap-1">
                        {item.members?.slice(0, 3).map((m) => (
                            <View key={m.user_id} className="flex-row items-center gap-2">
                                <View className="w-5 h-5 rounded-full bg-[#243447] items-center justify-center">
                                    <Text className="text-white text-[9px] font-bold">
                                        {m.full_name?.charAt(0)?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                                <Text className="text-gray-300 text-xs">{m.full_name}</Text>
                                <Text className="text-gray-600 text-[10px]">{m.role}</Text>
                            </View>
                        ))}
                        {(item.members?.length ?? 0) > 3 && (
                            <Text className="text-gray-500 text-[10px] ml-7">
                                +{(item.members?.length ?? 0) - 3} more
                            </Text>
                        )}
                    </View>
                )}

                {/* Footer */}
                <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-white/5">
                    <View className="flex-row items-center gap-1">
                        <MaterialIcons name="group" size={16} color="#64748B" />
                        <Text className="text-gray-400 text-xs">
                            {item.members_count} member{item.members_count !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    {!isMine && (
                        <TouchableOpacity
                            onPress={() => onJoin(item.id, item.name)}
                            activeOpacity={0.8}
                            className={`px-4 py-2 rounded-xl flex-row items-center gap-1.5 ${isEmpty ? 'bg-[#7C3AED]' : 'bg-[#243447]'
                                }`}
                        >
                            <Feather
                                name={isEmpty ? 'log-in' : 'user-plus'}
                                size={14}
                                color={isEmpty ? '#fff' : '#A78BFA'}
                            />
                            <Text
                                className={`text-xs font-semibold ${isEmpty ? 'text-white' : 'text-[#A78BFA]'
                                    }`}
                            >
                                Join
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    },
);

// ==================== Main Component ====================

const ClassDetailScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'ClassDetail'>>();
    const { classId } = route.params;

    const [groups, setGroups] = useState<ClassGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const currentUser = useUserStore((s) => s.userInfo);

    // Check if user joined any group → filter to only show their group
    const myGroup = groups.find((g) =>
        g.members?.some((m) => m.user_id === currentUser?.id),
    );
    const displayGroups = myGroup ? [myGroup] : groups;

    // ── Fetch ────────────────────────────────────────

    const fetchGroups = useCallback(
        async (isRefresh = false) => {
            try {
                if (!isRefresh) setLoading(true);
                const data = await getGroupsByClass(classId);
                setGroups(data as ClassGroup[]);
            } catch (error: any) {
                showError(error.response?.data?.message || 'Failed to load groups');
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [classId],
    );

    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                fetchGroups();
            });
            return () => task.cancel();
        }, [fetchGroups]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchGroups(true);
    }, [fetchGroups]);

    // ── Actions ──────────────────────────────────────

    const handleGroupPress = useCallback(
        (groupId: string) => {
            navigation.navigate('GroupDetail', { groupId });
        },
        [navigation],
    );

    const handleJoinGroup = useCallback(
        async (groupId: string, groupName: string) => {
            try {
                const result = await joinGroup(groupId);
                showSuccess(
                    `Joined ${groupName} as ${result.role_assigned}`,
                    'Welcome! 🎉',
                );
                fetchGroups(true);
            } catch (error: any) {
                showError(error.response?.data?.message || 'Failed to join group');
            }
        },
        [fetchGroups],
    );

    // ── Render ───────────────────────────────────────

    const renderGroup = useCallback(
        ({ item }: { item: ClassGroup }) => (
            <GroupCard
                item={item}
                onPress={handleGroupPress}
                onJoin={handleJoinGroup}
                isMine={item.members?.some((m) => m.user_id === currentUser?.id) ?? false}
            />
        ),
        [handleGroupPress, handleJoinGroup, currentUser],
    );

    const keyExtractor = useCallback((item: ClassGroup) => item.id, []);

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
                >
                    <Feather name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
                <View className="flex-1 ml-3">
                    <Text className="text-white text-lg font-bold">Class Groups</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                        {myGroup
                            ? 'You are in a group'
                            : `${groups.length} group${groups.length !== 1 ? 's' : ''} available`}
                    </Text>
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#7C3AED" />
                </View>
            ) : (
                <FlatList
                    data={displayGroups}
                    renderItem={renderGroup}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
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
                            <MaterialIcons name="groups" size={48} color="#64748B" />
                            <Text className="text-gray-400 mt-3 text-base">
                                No groups in this class yet
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

export default ClassDetailScreen;
