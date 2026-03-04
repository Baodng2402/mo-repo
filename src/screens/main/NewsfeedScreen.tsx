import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    StatusBar,
    RefreshControl,
    Animated,
    InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// ==================== Types ====================

interface PostAuthor {
    name: string;
    avatar: string;
    role: 'Leader' | 'Instructor' | 'Member';
}

interface Post {
    id: number;
    type: 'meeting' | 'announcement' | 'update';
    author: PostAuthor;
    content: string;
    meetingTime?: string;
    createdAt: string;
    reactions: number;
    comments: number;
}

// ==================== Constants ====================

const TAB_BAR_HEIGHT = 80;

const MOCK_POSTS: Post[] = [
    {
        id: 1,
        type: 'meeting',
        author: { name: 'Nguyen Van A', avatar: 'https://i.pravatar.cc/150?img=1', role: 'Leader' },
        content: 'Team Meeting tomorrow at 10:00 AM\nAgenda: Sprint planning and task allocation for next week.',
        meetingTime: '2026-02-04 10:00',
        createdAt: '2026-02-03 09:30',
        reactions: 5,
        comments: 3,
    },
    {
        id: 2,
        type: 'announcement',
        author: { name: 'Dr. Tran Thi B', avatar: 'https://i.pravatar.cc/150?img=10', role: 'Instructor' },
        content: 'Great progress on the project! Keep up the good work. Remember to submit the SRS document by Friday.',
        createdAt: '2026-02-02 14:00',
        reactions: 12,
        comments: 7,
    },
    {
        id: 3,
        type: 'update',
        author: { name: 'Tran Van C', avatar: 'https://i.pravatar.cc/150?img=3', role: 'Member' },
        content: 'Just finished implementing the login feature. Ready for code review!\n\nPR: #42 - User Authentication',
        createdAt: '2026-02-02 11:45',
        reactions: 8,
        comments: 2,
    },
    {
        id: 4,
        type: 'meeting',
        author: { name: 'Nguyen Van A', avatar: 'https://i.pravatar.cc/150?img=1', role: 'Leader' },
        content: 'Daily Standup - Quick sync on blockers and progress.',
        meetingTime: '2026-02-03 08:30',
        createdAt: '2026-02-01 18:00',
        reactions: 3,
        comments: 1,
    },
];

/** Post type → color + icon config */
const TYPE_CONFIG = {
    meeting: { icon: 'event', label: 'Meeting', color: '#06B6D4', bg: 'bg-cyan-500' },
    announcement: { icon: 'campaign', label: 'Announcement', color: '#F97316', bg: 'bg-orange-500' },
    update: { icon: 'update', label: 'Update', color: '#22C55E', bg: 'bg-green-500' },
};

/** Author role → avatar border color */
const ROLE_BORDER = {
    Leader: 'border-[#7C3AED]',
    Instructor: 'border-orange-500',
    Member: 'border-white/10',
};

// ==================== Helpers ====================

/** Format time to relative string (e.g. "5m", "2h", "3d") */
const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
};

// ==================== Memoized Components ====================

/** Animated like button with bounce effect */
const LikeButton = React.memo(
    ({
        postId,
        count,
        isLiked,
        onToggle,
    }: {
        postId: number;
        count: number;
        isLiked: boolean;
        onToggle: (id: number) => void;
    }) => {
        const scale = useRef(new Animated.Value(1)).current;

        const handlePress = () => {
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
            ]).start();
            onToggle(postId);
        };

        return (
            <TouchableOpacity onPress={handlePress} className="flex-row items-center gap-1.5">
                <Animated.View style={{ transform: [{ scale }] }}>
                    <MaterialIcons
                        name={isLiked ? 'favorite' : 'favorite-border'}
                        size={20}
                        color={isLiked ? '#EF4444' : '#475569'}
                    />
                </Animated.View>
                <Text
                    className={`text-sm font-medium ${isLiked ? 'text-red-400' : 'text-gray-500'}`}
                >
                    {count + (isLiked ? 1 : 0)}
                </Text>
            </TouchableOpacity>
        );
    },
);

/** Single post card */
const PostCard = React.memo(
    ({
        item,
        isLiked,
        onToggleLike,
    }: {
        item: Post;
        isLiked: boolean;
        onToggleLike: (id: number) => void;
    }) => {
        const config = TYPE_CONFIG[item.type];
        const borderClass = ROLE_BORDER[item.author.role];

        return (
            <View className="bg-[#1A2332] rounded-2xl p-4 mb-3">
                {/* Header */}
                <View className="flex-row items-center">
                    <View className="relative">
                        <Image
                            source={{ uri: item.author.avatar }}
                            className={`w-11 h-11 rounded-full border-2 ${borderClass}`}
                        />
                        {item.author.role !== 'Member' && (
                            <View
                                className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full items-center justify-center border-2 border-[#1A2332] ${item.author.role === 'Leader' ? 'bg-[#7C3AED]' : 'bg-orange-500'
                                    }`}
                            >
                                <MaterialIcons
                                    name={item.author.role === 'Leader' ? 'star' : 'school'}
                                    size={10}
                                    color="#fff"
                                />
                            </View>
                        )}
                    </View>
                    <View className="flex-1 ml-3">
                        <Text className="text-white text-base font-semibold">
                            {item.author.name}
                        </Text>
                        <View className="flex-row items-center gap-1.5 mt-0.5">
                            <Text className="text-gray-500 text-xs">{item.author.role}</Text>
                            <Text className="text-gray-600 text-[10px]">•</Text>
                            <Text className="text-gray-500 text-xs">
                                {formatTime(item.createdAt)}
                            </Text>
                        </View>
                    </View>
                    <View
                        className={`px-2.5 py-1 rounded-lg flex-row items-center gap-1 ${config.bg}`}
                    >
                        <MaterialIcons name={config.icon as any} size={12} color="#fff" />
                        <Text className="text-white text-[10px] font-semibold">{config.label}</Text>
                    </View>
                </View>

                {/* Content */}
                <Text className="text-white text-sm leading-6 mt-3">{item.content}</Text>

                {/* Meeting Card (only for meeting posts) */}
                {item.type === 'meeting' && item.meetingTime && (
                    <View className="bg-cyan-500/10 rounded-xl p-3 mt-3 flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-xl bg-cyan-500/20 items-center justify-center">
                            <MaterialIcons name="event" size={20} color="#06B6D4" />
                        </View>
                        <View>
                            <Text className="text-cyan-400 text-sm font-semibold">
                                {new Date(item.meetingTime).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </Text>
                            <Text className="text-cyan-300/70 text-xs">
                                {new Date(item.meetingTime).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View className="flex-row items-center gap-6 mt-4 pt-3 border-t border-white/5">
                    <LikeButton
                        postId={item.id}
                        count={item.reactions}
                        isLiked={isLiked}
                        onToggle={onToggleLike}
                    />
                    <TouchableOpacity className="flex-row items-center gap-1.5">
                        <Feather name="message-circle" size={18} color="#475569" />
                        <Text className="text-gray-500 text-sm font-medium">{item.comments}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Feather name="share-2" size={18} color="#475569" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    },
);

// ==================== Main Component ====================

const NewsfeedScreen = () => {
    const insets = useSafeAreaInsets();
    const [refreshing, setRefreshing] = useState(false);
    const [likedPosts, setLikedPosts] = useState<number[]>([]);
    const [ready, setReady] = useState(false);

    /** Defer render until after navigation animation */
    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                setReady(true);
            });
            return () => task.cancel();
        }, []),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setRefreshing(false);
    }, []);

    const toggleLike = useCallback((postId: number) => {
        setLikedPosts((prev) =>
            prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId],
        );
    }, []);

    const renderPost = useCallback(
        ({ item }: { item: Post }) => (
            <PostCard
                item={item}
                isLiked={likedPosts.includes(item.id)}
                onToggleLike={toggleLike}
            />
        ),
        [likedPosts, toggleLike],
    );

    const keyExtractor = useCallback((item: Post) => item.id.toString(), []);

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* ── Header ── */}
            <View className="px-4 py-3">
                <Text className="text-white text-2xl font-bold">Newsfeed</Text>
                <Text className="text-gray-500 text-sm mt-0.5">Stay updated with your team</Text>
            </View>

            {/* ── Posts ── */}
            {ready && (
                <FlatList
                    data={MOCK_POSTS}
                    renderItem={renderPost}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
                    }}
                    showsVerticalScrollIndicator={false}
                    // Performance
                    initialNumToRender={4}
                    maxToRenderPerBatch={6}
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
                />
            )}

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
                <Feather name="edit-3" size={22} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default NewsfeedScreen;
