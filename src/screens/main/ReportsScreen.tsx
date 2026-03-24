import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
    generateSrsReport,
    getCommitReport,
    type CommitReport,
} from '@/services/reportService';
import { showError, showSuccess } from '@/utils/toast';

type ReportMode = 'none' | 'srs'  | 'commit';

const getStatusChipClass = (status: string) => {
    const normalized = status.toUpperCase();

    if (normalized.includes('DONE')) {
        return 'bg-green-500/15 text-green-400';
    }

    if (normalized.includes('PROGRESS') || normalized.includes('IN_')) {
        return 'bg-blue-500/15 text-blue-400';
    }

    return 'bg-slate-500/15 text-slate-400';
};

const ReportsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Reports'>>();
    const { groupId } = route.params;

    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<ReportMode>('none');
    const [srs, setSrs] = useState('');
    const [commit, setCommit] = useState<CommitReport | null>(null);

    const runSrs = useCallback(async () => {
        try {
            setLoading(true);
            setMode('srs');
            const res = await generateSrsReport(groupId);
            setSrs(res.markdown || 'No SRS output');
            showSuccess('SRS generated');
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to generate SRS');
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    const runCommit = useCallback(async () => {
        try {
            setLoading(true);
            setMode('commit');
            const res = await getCommitReport(groupId);
            setCommit(res);
        } catch (error: any) {
            showError(
                error.response?.data?.message ||
                'Failed to load commit report. Ensure group has linked repos and GitHub integration.'
            );
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
                >
                    <Feather name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold ml-3">Reports</Text>
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 30 }}>
                <View className="flex-row gap-2 mb-4">
                    <TouchableOpacity
                        onPress={runSrs}
                        className="flex-1 bg-[#7C3AED] rounded-xl py-3 items-center"
                        activeOpacity={0.8}
                    >
                        <Text className="text-white text-xs font-semibold">Generate SRS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={runCommit}
                        className="flex-1 bg-[#16A34A] rounded-xl py-3 items-center"
                        activeOpacity={0.8}
                    >
                        <Text className="text-white text-xs font-semibold">Commits</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View className="py-16 items-center">
                        <ActivityIndicator size="large" color="#7C3AED" />
                    </View>
                ) : null}

                {!loading && mode === 'none' ? (
                    <View className="bg-[#1A2332] rounded-2xl p-5 items-center">
                        <Text className="text-gray-500 text-center">
                            Choose a report above to load your group insights.
                        </Text>
                    </View>
                ) : null}

                {!loading && mode === 'srs' ? (
                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        <Text className="text-white font-semibold mb-3">SRS Markdown</Text>
                        <Text className="text-gray-300 text-xs leading-5">{srs}</Text>
                    </View>
                ) : null}
                {!loading && mode === 'commit' && commit ? (
                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        <Text className="text-white font-semibold mb-3">{commit.groupName}</Text>

                        {commit.repositories.length === 0 ? (
                            <View className="bg-[#243447] rounded-xl p-3">
                                <Text className="text-gray-400 text-xs text-center">
                                    No linked repositories with commit data yet.
                                </Text>
                            </View>
                        ) : (
                            commit.repositories.map((repo, index) => (
                                <View
                                    key={repo.repository}
                                    className={`mb-4 pb-3 ${index < commit.repositories.length - 1 ? 'border-b border-white/5' : ''}`}
                                >
                                    <Text className="text-[#A78BFA] text-sm font-semibold mb-2">{repo.repository}</Text>
                                    {repo.contributors.length === 0 ? (
                                        <Text className="text-gray-500 text-xs">No contributors found.</Text>
                                    ) : (
                                        repo.contributors.map((c) => (
                                            <Text key={`${repo.repository}-${c.author}`} className="text-gray-300 text-xs mb-1">
                                                {c.author}: {c.commits} commits, +{c.lines_added}/-{c.lines_deleted}
                                            </Text>
                                        ))
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
};

export default ReportsScreen;
