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
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getGroups } from '@/services/groupService';
import { showError, showSuccess } from '@/utils/toast';
import type { Group, GroupStatus } from '@/types/group';
import type { RootStackParamList } from '@/navigation/AppNavigator';

// ==================== Constants ====================

const TAB_BAR_HEIGHT = 80;

const STATUS_CONFIG: Record<GroupStatus, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Active', color: 'text-green-400', bg: 'bg-green-500/15' },
    ARCHIVED: { label: 'Archived', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
    COMPLETED: { label: 'Completed', color: 'text-blue-400', bg: 'bg-blue-500/15' },
};

// ==================== Memoized Components ====================

/**
 * Card shown when user is browsing available public groups.
 * Shows group name, status, member count, and a "Request to Join" button.
 */
const PublicGroupCard = React.memo(
    ({
        item,
        onJoinRequest,
        onPress,
    }: {
        item: Group;
        onJoinRequest: (id: string, name: string) => void;
        onPress: (id: string) => void;
    }) => {
        const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ACTIVE;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPress(item.id)}
                className="bg-[#1A2332] rounded-2xl p-4 mb-3"
            >
                {/* Header */}
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1.5">
                            <View className={`px-2 py-0.5 rounded-md ${statusCfg.bg}`}>
                                <Text className={`text-[10px] font-semibold ${statusCfg.color}`}>
                                    {statusCfg.label}
                                </Text>
                            </View>
                            {item.semester && (
                                <Text className="text-gray-500 text-xs">{item.semester}</Text>
                            )}
                        </View>
                        <Text className="text-white text-lg font-bold">{item.name}</Text>
                        {item.project_name && (
                            <Text className="text-gray-400 text-sm mt-0.5">
                                {item.project_name}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Integration Tags */}
                <View className="flex-row gap-1.5 mt-3">
                    {item.jira_project_key && (
                        <View className="bg-[#0052CC]/15 px-2.5 py-1 rounded-lg">
                            <Text className="text-[#4C9AFF] text-xs font-medium">
                                Jira: {item.jira_project_key}
                            </Text>
                        </View>
                    )}
                    {item.github_repo_url && (
                        <View className="bg-[#7C3AED]/15 px-2.5 py-1 rounded-lg">
                            <Text className="text-[#7C3AED] text-xs font-medium">GitHub</Text>
                        </View>
                    )}
                </View>

                {/* Footer Row */}
                <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-white/5">
                    <View className="flex-row items-center gap-1">
                        <MaterialIcons name="group" size={16} color="#64748B" />
                        <Text className="text-gray-400 text-xs">
                            {item.members_count} member{item.members_count !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => onJoinRequest(item.id, item.name)}
                        activeOpacity={0.8}
                        className="bg-[#7C3AED] px-4 py-2 rounded-xl flex-row items-center gap-1.5"
                    >
                        <Feather name="user-plus" size={14} color="#fff" />
                        <Text className="text-white text-xs font-semibold">Join</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    },
);

/** Memoized empty state for public groups */
const EmptyState = React.memo(() => (
    <View className="items-center py-16">
        <MaterialIcons name="search-off" size={48} color="#64748B" />
        <Text className="text-gray-400 mt-3 text-base">No groups available</Text>
        <Text className="text-gray-500 mt-1 text-sm text-center px-8">
            Ask your instructor or class leader to create a group
        </Text>
    </View>
));

// ==================== Main Component ====================

const GroupsScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    // ── State ────────────────────────────────────────
    // In real app, this would be derived from user store.
    // For now, null = no group (browse public), non-null = user has a group.
    const [myGroup, setMyGroup] = useState<Group | null>(null);

    const [publicGroups, setPublicGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);

    const isMounted = useRef(true);

    // ── Fetch Groups ─────────────────────────────────

    const fetchGroups = useCallback(
        async (pageNum = 1, isRefresh = false) => {
            try {
                if (pageNum === 1 && !isRefresh) setLoading(true);

                const result = await getGroups({
                    page: pageNum,
                    limit: 20,
                    search: searchQuery.trim() || undefined,
                });

                if (!isMounted.current) return;

                const allGroups = result.data;

                // Simulate: if user already has a group, separate it out
                // In production, use a dedicated endpoint like GET /api/groups/my-group
                if (allGroups.length > 0 && !myGroup) {
                    // For now, first group = user's group (remove this logic when BE is ready)
                    setMyGroup(allGroups[0]);
                    const remaining = allGroups.slice(1);
                    if (pageNum === 1) {
                        setPublicGroups(remaining);
                    } else {
                        setPublicGroups((prev) => [...prev, ...remaining]);
                    }
                } else {
                    if (pageNum === 1) {
                        setPublicGroups(allGroups);
                    } else {
                        setPublicGroups((prev) => [...prev, ...allGroups]);
                    }
                }

                setPage(pageNum);
                setTotalPages(result.meta.total_pages);
            } catch (error: any) {
                if (!isMounted.current) return;
                showError(error.response?.data?.message || 'Failed to load groups');
            } finally {
                if (isMounted.current) {
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [searchQuery, myGroup],
    );

    useFocusEffect(
        useCallback(() => {
            isMounted.current = true;
            const task = InteractionManager.runAfterInteractions(() => {
                fetchGroups(1);
            });
            return () => {
                isMounted.current = false;
                task.cancel();
            };
        }, [fetchGroups]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchGroups(1, true);
    }, [fetchGroups]);

    const onLoadMore = useCallback(() => {
        if (loadingMore || page >= totalPages) return;
        setLoadingMore(true);
        fetchGroups(page + 1);
    }, [loadingMore, page, totalPages, fetchGroups]);

    // ── Actions ──────────────────────────────────────

    const handleGroupPress = useCallback(
        (groupId: string) => {
            navigation.navigate('GroupDetail', { groupId });
        },
        [navigation],
    );

    const handleJoinRequest = useCallback(
        (_groupId: string, groupName: string) => {
            // TODO: Call API to send join request
            showSuccess(
                `Join request sent to ${groupName}. Wait for the leader to accept.`,
                'Request Sent 🎉',
            );
        },
        [],
    );

    const handleCreatePress = useCallback(() => {
        navigation.navigate('CreateGroup');
    }, [navigation]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
    }, []);

    // ── FlatList callbacks ───────────────────────────

    const renderPublicGroup = useCallback(
        ({ item }: { item: Group }) => (
            <PublicGroupCard
                item={item}
                onJoinRequest={handleJoinRequest}
                onPress={handleGroupPress}
            />
        ),
        [handleGroupPress, handleJoinRequest],
    );

    const keyExtractor = useCallback((item: Group) => item.id, []);

    const ListFooter = useMemo(
        () =>
            loadingMore ? (
                <ActivityIndicator
                    size="small"
                    color="#7C3AED"
                    style={{ paddingVertical: 16 }}
                />
            ) : null,
        [loadingMore],
    );

    const ListEmpty = useMemo(() => <EmptyState />, []);

    // ── My Group Header (shown above public groups list) ──

    const ListHeader = useMemo(() => {
        if (!myGroup) return null;

        const statusCfg = STATUS_CONFIG[myGroup.status] || STATUS_CONFIG.ACTIVE;

        return (
            <View className="mb-5">
                {/* My Group Label */}
                <Text className="text-white text-lg font-semibold mb-3">My Group</Text>

                {/* My Group Card */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleGroupPress(myGroup.id)}
                    className="bg-[#1A2332] rounded-2xl p-4"
                >
                    <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                            <View className="flex-row items-center gap-2 mb-1.5">
                                <View className={`px-2 py-0.5 rounded-md ${statusCfg.bg}`}>
                                    <Text
                                        className={`text-[10px] font-semibold ${statusCfg.color}`}
                                    >
                                        {statusCfg.label}
                                    </Text>
                                </View>
                                {myGroup.semester && (
                                    <Text className="text-gray-500 text-xs">
                                        {myGroup.semester}
                                    </Text>
                                )}
                            </View>
                            <Text className="text-white text-xl font-bold">{myGroup.name}</Text>
                            {myGroup.project_name && (
                                <Text className="text-gray-400 text-sm mt-0.5">
                                    {myGroup.project_name}
                                </Text>
                            )}
                        </View>
                        <Feather name="chevron-right" size={20} color="#475569" />
                    </View>

                    {/* Integration Tags */}
                    {(myGroup.jira_project_key || myGroup.github_repo_url) && (
                        <View className="flex-row gap-1.5 mt-3">
                            {myGroup.jira_project_key && (
                                <View className="bg-[#0052CC]/15 px-2.5 py-1 rounded-lg">
                                    <Text className="text-[#4C9AFF] text-xs font-medium">
                                        Jira: {myGroup.jira_project_key}
                                    </Text>
                                </View>
                            )}
                            {myGroup.github_repo_url && (
                                <View className="bg-[#7C3AED]/15 px-2.5 py-1 rounded-lg">
                                    <Text className="text-[#7C3AED] text-xs font-medium">
                                        GitHub
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Footer */}
                    <View className="flex-row items-center gap-1 mt-4 pt-3 border-t border-white/5">
                        <MaterialIcons name="group" size={16} color="#64748B" />
                        <Text className="text-gray-400 text-xs">
                            {myGroup.members_count} member
                            {myGroup.members_count !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Divider + "Browse Teams" label */}
                <Text className="text-gray-600 text-xs font-semibold mt-6 mb-2 ml-1">
                    OTHER TEAMS
                </Text>
            </View>
        );
    }, [myGroup, handleGroupPress]);

    // ── Main Render ──────────────────────────────────

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <View className="px-4 py-3 flex-row justify-between items-center">
                <View>
                    <Text className="text-white text-2xl font-bold">
                        {myGroup ? 'My Group' : 'Find a Group'}
                    </Text>
                    <Text className="text-gray-400 text-sm mt-0.5">
                        {myGroup
                            ? 'Manage your project group'
                            : 'Browse & join a team'}
                    </Text>
                </View>
                {!myGroup && (
                    <TouchableOpacity
                        onPress={handleCreatePress}
                        activeOpacity={0.8}
                        className="w-10 h-10 bg-[#7C3AED] rounded-xl items-center justify-center"
                    >
                        <Feather name="plus" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Search (only when browsing public groups or always visible) */}
            <View className="px-4 mb-3">
                <View
                    className={`flex-row items-center bg-[#1A2332] rounded-xl px-3 h-12 border ${searchFocused ? 'border-[#7C3AED]' : 'border-white/10'
                        }`}
                >
                    <Feather
                        name="search"
                        size={18}
                        color={searchFocused ? '#7C3AED' : '#64748B'}
                    />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        onSubmitEditing={() => fetchGroups(1)}
                        returnKeyType="search"
                        placeholder={myGroup ? 'Search teams...' : 'Search available groups...'}
                        placeholderTextColor="#64748B"
                        className="flex-1 ml-2 text-white text-sm"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={handleClearSearch}>
                            <Feather name="x" size={18} color="#64748B" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#7C3AED" />
                </View>
            ) : (
                <FlatList
                    data={myGroup ? publicGroups : publicGroups}
                    renderItem={renderPublicGroup}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
                    }}
                    showsVerticalScrollIndicator={false}
                    // Performance
                    initialNumToRender={8}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    // Features
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#7C3AED"
                            colors={['#7C3AED']}
                        />
                    }
                    onEndReached={onLoadMore}
                    onEndReachedThreshold={0.3}
                    ListHeaderComponent={ListHeader}
                    ListFooterComponent={ListFooter}
                    ListEmptyComponent={ListEmpty}
                />
            )}
        </SafeAreaView>
    );
};

export default GroupsScreen;
