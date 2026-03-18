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
    getAssignmentReport,
    getCommitReport,
    type AssignmentReport,
    type CommitReport,
} from '@/services/reportService';
import { showError, showSuccess } from '@/utils/toast';

type ReportMode = 'none' | 'srs' | 'assignment' | 'commit';

const ReportsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Reports'>>();
    const { groupId } = route.params;

    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<ReportMode>('none');
    const [srs, setSrs] = useState('');
    const [assignment, setAssignment] = useState<AssignmentReport | null>(null);
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

    const runAssignment = useCallback(async () => {
        try {
            setLoading(true);
            setMode('assignment');
            const res = await getAssignmentReport(groupId);
            setAssignment(res);
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to load assignment report');
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
                        onPress={runAssignment}
                        className="flex-1 bg-[#2563EB] rounded-xl py-3 items-center"
                        activeOpacity={0.8}
                    >
                        <Text className="text-white text-xs font-semibold">Assignments</Text>
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
                            Run a report to view generated data.
                        </Text>
                    </View>
                ) : null}

                {!loading && mode === 'srs' ? (
                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        <Text className="text-white font-semibold mb-3">SRS Markdown</Text>
                        <Text className="text-gray-300 text-xs leading-5">{srs}</Text>
                    </View>
                ) : null}

                {!loading && mode === 'assignment' && assignment ? (
                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        <Text className="text-white font-semibold mb-1">{assignment.groupName}</Text>
                        <Text className="text-gray-500 text-xs mb-3">Total tasks: {assignment.totalTasks}</Text>
                        {assignment.assignments.map((item) => (
                            <View key={item.key} className="py-2 border-b border-white/5">
                                <Text className="text-white text-sm">{item.summary}</Text>
                                <Text className="text-gray-500 text-xs mt-1">{item.key} • {item.status} • {item.assignee}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {!loading && mode === 'commit' && commit ? (
                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        <Text className="text-white font-semibold mb-3">{commit.groupName}</Text>
                        {commit.repositories.map((repo) => (
                            <View key={repo.repository} className="mb-4 pb-3 border-b border-white/5">
                                <Text className="text-[#A78BFA] text-sm font-semibold mb-2">{repo.repository}</Text>
                                {repo.contributors.map((c) => (
                                    <Text key={`${repo.repository}-${c.author}`} className="text-gray-300 text-xs mb-1">
                                        {c.author}: {c.commits} commits, +{c.lines_added}/-{c.lines_deleted}
                                    </Text>
                                ))}
                            </View>
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
};

export default ReportsScreen;
