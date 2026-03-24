import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    InteractionManager,
    RefreshControl,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { getMyGroups } from '@/services/studentService';
import type { Group } from '@/types/group';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { showError } from '@/utils/toast';

const TasksScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchGroups = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getMyGroups();
            setGroups(data);
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Failed to load groups');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            const task = InteractionManager.runAfterInteractions(() => {
                fetchGroups();
            });
            return () => task.cancel();
        }, [fetchGroups]),
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchGroups();
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
                <ActivityIndicator size="large" color="#2563EB" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            <View className="px-4 pt-3 pb-2">
                <Text className="text-white text-2xl font-black">Tasks</Text>
                <Text className="text-gray-400 text-sm mt-1">
                    Task CRUD is now managed inside each Group Detail.
                </Text>
            </View>

            <View className="mx-4 mt-2 mb-3 bg-[#1A2332] rounded-2xl p-4 border border-[#243447]">
                <View className="flex-row items-start gap-2">
                    <MaterialIcons name="tips-and-updates" size={18} color="#60A5FA" />
                    <Text className="text-gray-300 text-sm flex-1">
                        Open a group below, then use the Group Tasks section to create, edit, move status, and delete tasks.
                    </Text>
                </View>
            </View>

            <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#2563EB"
                        colors={['#2563EB']}
                    />
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
                        activeOpacity={0.85}
                        className="mx-4 mb-3 bg-[#1A2332] rounded-2xl p-4"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-3">
                                <Text className="text-white text-base font-bold" numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text className="text-gray-400 text-xs mt-1" numberOfLines={1}>
                                    {item.project_name || 'No project title yet'}
                                </Text>
                                <View className="flex-row items-center gap-2 mt-2">
                                    <View className="bg-[#243447] px-2 py-1 rounded-md">
                                        <Text className="text-[#93C5FD] text-[10px] font-semibold">
                                            {item.members_count} members
                                        </Text>
                                    </View>
                                    {!!item.jira_project_key && (
                                        <View className="bg-[#1D4ED8]/20 px-2 py-1 rounded-md">
                                            <Text className="text-[#93C5FD] text-[10px] font-semibold">
                                                {item.jira_project_key}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <Feather name="chevron-right" size={18} color="#64748B" />
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View className="items-center px-8 py-16">
                        <MaterialIcons name="group-off" size={48} color="#475569" />
                        <Text className="text-gray-400 text-center mt-3">
                            You have not joined any group yet.
                        </Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </SafeAreaView>
    );
};

export default TasksScreen;
