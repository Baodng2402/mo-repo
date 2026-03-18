import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
    getGroupSubmissions,
    submitGroupDocument,
    type DocumentSubmission,
} from '@/services/documentService';
import { showError, showSuccess } from '@/utils/toast';

const STATUS_COLOR: Record<string, string> = {
    PENDING: '#EAB308',
    APPROVED: '#22C55E',
    REJECTED: '#EF4444',
};

const normalizeUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

const DocumentSubmissionsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Documents'>>();
    const { groupId } = route.params;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [items, setItems] = useState<DocumentSubmission[]>([]);

    const fetchSubmissions = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setLoading(true);
            const data = await getGroupSubmissions(groupId);
            setItems(data || []);
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to load submissions');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [groupId]);

    useFocusEffect(
        useCallback(() => {
            fetchSubmissions();
        }, [fetchSubmissions]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchSubmissions(true);
    }, [fetchSubmissions]);

    const handleSubmit = useCallback(async () => {
        if (!title.trim() || !url.trim()) {
            showError('Title and URL are required');
            return;
        }

        try {
            setSubmitting(true);
            await submitGroupDocument(groupId, {
                title: title.trim(),
                document_url: url.trim(),
            });
            setTitle('');
            setUrl('');
            showSuccess('Document submitted successfully');
            fetchSubmissions(true);
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to submit document');
        } finally {
            setSubmitting(false);
        }
    }, [fetchSubmissions, groupId, title, url]);

    const handleOpenUrl = useCallback(async (rawUrl: string) => {
        const normalizedUrl = normalizeUrl(rawUrl);

        if (!normalizedUrl) {
            showError('Invalid document URL');
            return;
        }

        try {
            const supported = await Linking.canOpenURL(normalizedUrl);
            if (!supported) {
                showError('Cannot open this URL');
                return;
            }

            await Linking.openURL(normalizedUrl);
        } catch {
            showError('Failed to open URL');
        }
    }, []);

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
            </SafeAreaView>
        );
    }

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
                <Text className="text-white text-lg font-bold ml-3">Document Submissions</Text>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 16, paddingBottom: 30 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#7C3AED"
                        colors={['#7C3AED']}
                    />
                }
            >
                <View className="bg-[#1A2332] rounded-2xl p-4 mb-4">
                    <Text className="text-white text-base font-semibold mb-3">Submit new document</Text>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Title (e.g. SRS v1)"
                        placeholderTextColor="#64748B"
                        className="h-12 bg-[#101922] rounded-xl px-4 text-white border border-white/10 mb-3"
                    />
                    <TextInput
                        value={url}
                        onChangeText={setUrl}
                        placeholder="Public document URL"
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                        className="h-12 bg-[#101922] rounded-xl px-4 text-white border border-white/10"
                    />
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting}
                        className={`mt-4 rounded-xl py-3.5 items-center ${submitting ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
                        activeOpacity={0.8}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text className="text-white font-semibold">Submit</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <Text className="text-white text-base font-semibold mb-3">History</Text>
                {items.length === 0 ? (
                    <View className="bg-[#1A2332] rounded-2xl p-5 items-center">
                        <Text className="text-gray-500">No submissions yet</Text>
                    </View>
                ) : (
                    items.map((item) => (
                        <View key={item.id} className="bg-[#1A2332] rounded-2xl p-4 mb-3">
                            <View className="flex-row items-center justify-between">
                                <Text className="text-white font-semibold flex-1" numberOfLines={1}>
                                    {item.title}
                                </Text>
                                <View
                                    className="px-2 py-1 rounded-md"
                                    style={{ backgroundColor: `${STATUS_COLOR[item.status] || '#64748B'}25` }}
                                >
                                    <Text
                                        className="text-[10px] font-bold"
                                        style={{ color: STATUS_COLOR[item.status] || '#64748B' }}
                                    >
                                        {item.status}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleOpenUrl(item.document_url)}
                            >
                                <Text className="text-[#93C5FD] text-xs mt-2 underline" numberOfLines={1}>
                                    {item.document_url}
                                </Text>
                            </TouchableOpacity>
                            {item.feedback ? (
                                <Text className="text-gray-400 text-xs mt-2">Feedback: {item.feedback}</Text>
                            ) : null}
                            {typeof item.score === 'number' ? (
                                <Text className="text-green-400 text-xs mt-1">Score: {item.score}</Text>
                            ) : null}
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DocumentSubmissionsScreen;
