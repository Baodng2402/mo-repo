import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getNotifications,
  markNotificationAsRead,
  type AppNotification,
} from '@/services/notificationService';
import { showError } from '@/utils/toast';

// ==================== Types ====================

type FeedType = 'announcement' | 'task' | 'system';

interface FeedItem {
  id: string;
  type: FeedType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

// ==================== Constants ====================

const TAB_BAR_HEIGHT = 80;

const detectType = (title: string, message: string): FeedType => {
  const text = `${title} ${message}`.toLowerCase();
  if (text.includes('task') || text.includes('jira')) return 'task';
  if (text.includes('class') || text.includes('invite')) return 'announcement';
  return 'system';
};

/** Post type → color + icon config */
const TYPE_CONFIG = {
  announcement: { icon: 'campaign', label: 'Announcement', color: '#F97316', bg: 'bg-orange-500' },
  task: { icon: 'assignment', label: 'Task', color: '#3B82F6', bg: 'bg-blue-500' },
  system: { icon: 'notifications', label: 'System', color: '#22C55E', bg: 'bg-green-500' },
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

/** Single feed card */
const PostCard = React.memo(
  ({ item, onPress }: { item: FeedItem; onPress: (item: FeedItem) => void }) => {
    const config = TYPE_CONFIG[item.type];

    return (
      <TouchableOpacity
        onPress={() => onPress(item)}
        activeOpacity={0.85}
        className="mb-3 rounded-2xl bg-[#1A2332] p-4">
        {/* Header */}
        <View className="flex-row items-start">
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${config.color}25` }}>
            <MaterialIcons name={config.icon as any} size={20} color={config.color} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-white" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500">{formatTime(item.createdAt)} ago</Text>
          </View>
          <View className={`flex-row items-center gap-1 rounded-lg px-2.5 py-1 ${config.bg}`}>
            <MaterialIcons name={config.icon as any} size={12} color="#fff" />
            <Text className="text-[10px] font-semibold text-white">{config.label}</Text>
          </View>
        </View>

        {/* Content */}
        <Text className="mt-3 text-sm leading-6 text-white">{item.message}</Text>

        <View className="mt-4 flex-row items-center justify-between border-t border-white/5 pt-3">
          <Text className={`text-xs ${item.isRead ? 'text-gray-500' : 'text-[#A78BFA]'}`}>
            {item.isRead ? 'Read' : 'Tap to mark as read'}
          </Text>
          {!item.isRead && <View className="h-2 w-2 rounded-full bg-[#A78BFA]" />}
        </View>
      </TouchableOpacity>
    );
  }
);

// ==================== Main Component ====================

const NewsfeedScreen = () => {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const mapFeed = useCallback((items: AppNotification[]): FeedItem[] => {
    return items.map((item) => ({
      id: item.id,
      type: detectType(item.title, item.message),
      title: item.title,
      message: item.message,
      createdAt: item.created_at,
      isRead: item.is_read,
    }));
  }, []);

  const fetchFeed = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const data = await getNotifications();
        setFeed(mapFeed(data));
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mapFeed]
  );

  /** Defer render until after navigation animation */
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        setReady(true);
        fetchFeed();
      });
      return () => task.cancel();
    }, [fetchFeed])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchFeed(true);
  }, [fetchFeed]);

  const handlePressFeed = useCallback(async (item: FeedItem) => {
    if (item.isRead) return;
    try {
      await markNotificationAsRead(item.id);
      setFeed((prev) => prev.map((x) => (x.id === item.id ? { ...x, isRead: true } : x)));
    } catch {
      // Keep silent to avoid noisy UX when mark read fails.
    }
  }, []);

  const renderPost = useCallback(
    ({ item }: { item: FeedItem }) => <PostCard item={item} onPress={handlePressFeed} />,
    [handlePressFeed]
  );

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  if (loading && !ready) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* ── Header ── */}
      <View className="px-4 py-3">
        <Text className="text-2xl font-bold text-white">Newsfeed</Text>
        <Text className="mt-0.5 text-sm text-gray-500">Team and class notifications</Text>
      </View>

      {/* ── Posts ── */}
      {ready && (
        <FlatList
          data={feed}
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
          ListEmptyComponent={
            <View className="items-center py-16">
              <MaterialIcons name="notifications-none" size={48} color="#475569" />
              <Text className="mt-3 text-gray-500">No notifications yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default NewsfeedScreen;
