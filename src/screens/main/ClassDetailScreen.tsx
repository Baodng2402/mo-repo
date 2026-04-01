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
import { createOrGetConversation } from '@/services/chatService';
import { getCurrentWeek } from '@/services/semesterService';
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
        className="mb-3 rounded-2xl bg-[#1A2332] p-4">
        {/* Header */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-white">{item.name}</Text>
            {item.topic && (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Feather name="book-open" size={12} color="#64748B" />
                <Text className="text-xs text-gray-400">{item.topic.name}</Text>
              </View>
            )}
            {item.project_name && (
              <Text className="mt-0.5 text-sm text-gray-400">{item.project_name}</Text>
            )}
          </View>
          {isMine && (
            <View className="rounded-lg bg-[#7C3AED]/20 px-2.5 py-1">
              <Text className="text-[10px] font-bold text-[#A78BFA]">Your Group</Text>
            </View>
          )}
        </View>

        {/* Members preview */}
        {(item.members?.length ?? 0) > 0 && (
          <View className="mt-3 gap-1">
            {item.members?.slice(0, 3).map((m) => (
              <View key={m.user_id} className="flex-row items-center gap-2">
                <View className="h-5 w-5 items-center justify-center rounded-full bg-[#243447]">
                  <Text className="text-[9px] font-bold text-white">
                    {m.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-300">{m.full_name}</Text>
                <Text className="text-[10px] text-gray-600">{m.role}</Text>
              </View>
            ))}
            {(item.members?.length ?? 0) > 3 && (
              <Text className="ml-7 text-[10px] text-gray-500">
                +{(item.members?.length ?? 0) - 3} more
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View className="mt-4 flex-row items-center justify-between border-t border-white/5 pt-3">
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="group" size={16} color="#64748B" />
            <Text className="text-xs text-gray-400">
              {item.members_count} member{item.members_count !== 1 ? 's' : ''}
            </Text>
          </View>
          {!isMine && (
            <TouchableOpacity
              onPress={() => onJoin(item.id, item.name)}
              activeOpacity={0.8}
              className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2 ${
                isEmpty ? 'bg-[#7C3AED]' : 'bg-[#243447]'
              }`}>
              <Feather
                name={isEmpty ? 'log-in' : 'user-plus'}
                size={14}
                color={isEmpty ? '#fff' : '#A78BFA'}
              />
              <Text
                className={`text-xs font-semibold ${isEmpty ? 'text-white' : 'text-[#A78BFA]'}`}>
                Join
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

// ==================== Main Component ====================

const ClassDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClassDetail'>>();
  const { classId, lecturerId } = route.params;

  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const currentUser = useUserStore((s) => s.userInfo);

  const isStudent = currentUser?.role === 'STUDENT' || currentUser?.role === 'GROUP_LEADER';
  const canChat = isStudent && !!lecturerId;

  // Check if user joined any group → filter to only show their group
  const myGroup = groups.find((g) => g.members?.some((m) => m.user_id === currentUser?.id));
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
    [classId]
  );

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchGroups();
      });
      return () => task.cancel();
    }, [fetchGroups])
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
    [navigation]
  );

  const handleJoinGroup = useCallback(
    async (groupId: string, groupName: string) => {
      try {
        const result = await joinGroup(groupId);
        showSuccess(`Joined ${groupName} as ${result.role_assigned}`, 'Welcome! 🎉');
        fetchGroups(true);
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to join group');
      }
    },
    [fetchGroups]
  );

  // ── Chat with Lecturer ───────────────────────────

  const handleChatWithLecturer = useCallback(async () => {
    if (!canChat || !currentUser) return;
    setChatLoading(true);
    try {
      const { semester } = await getCurrentWeek();
      if (!semester) {
        showError('No active semester found');
        return;
      }
      const conversation = await createOrGetConversation({
        semester_id: semester.id,
        class_id: classId,
        student_id: currentUser.id,
        lecturer_id: lecturerId!,
      });
      navigation.navigate('ChatDetail', {
        conversationId: conversation.id,
        title: conversation.counterpart.fullName,
      });
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Unable to open conversation');
    } finally {
      setChatLoading(false);
    }
  }, [canChat, classId, currentUser, lecturerId, navigation]);

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
    [handleGroupPress, handleJoinGroup, currentUser]
  );

  const keyExtractor = useCallback((item: ClassGroup) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-bold text-white">Class Groups</Text>
          <Text className="mt-0.5 text-xs text-gray-400">
            {myGroup
              ? 'You are in a group'
              : `${groups.length} group${groups.length !== 1 ? 's' : ''} available`}
          </Text>
        </View>
        {canChat && (
          <TouchableOpacity
            onPress={handleChatWithLecturer}
            disabled={chatLoading}
            className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
            {chatLoading ? (
              <ActivityIndicator size="small" color="#A78BFA" />
            ) : (
              <Feather name="message-circle" size={20} color="#A78BFA" />
            )}
          </TouchableOpacity>
        )}
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
              <Text className="mt-3 text-base text-gray-400">No groups in this class yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default ClassDetailScreen;
