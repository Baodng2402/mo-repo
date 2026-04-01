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

  const fetchSubmissions = useCallback(
    async (isRefresh = false) => {
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
    },
    [groupId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchSubmissions();
    }, [fetchSubmissions])
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
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="ml-3 text-lg font-bold text-white">Document Submissions</Text>
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
        }>
        <View className="mb-4 rounded-2xl bg-[#1A2332] p-4">
          <Text className="mb-3 text-base font-semibold text-white">Submit new document</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title (e.g. SRS v1)"
            placeholderTextColor="#64748B"
            className="mb-3 h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
          />
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Public document URL"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            className="h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
          />
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`mt-4 items-center rounded-xl py-3.5 ${submitting ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
            activeOpacity={0.8}>
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Submit</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text className="mb-3 text-base font-semibold text-white">History</Text>
        {items.length === 0 ? (
          <View className="items-center rounded-2xl bg-[#1A2332] p-5">
            <Text className="text-gray-500">No submissions yet</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} className="mb-3 rounded-2xl bg-[#1A2332] p-4">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 font-semibold text-white" numberOfLines={1}>
                  {item.title}
                </Text>
                <View
                  className="rounded-md px-2 py-1"
                  style={{ backgroundColor: `${STATUS_COLOR[item.status] || '#64748B'}25` }}>
                  <Text
                    className="text-[10px] font-bold"
                    style={{ color: STATUS_COLOR[item.status] || '#64748B' }}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleOpenUrl(item.document_url)}>
                <Text className="mt-2 text-xs text-[#93C5FD] underline" numberOfLines={1}>
                  {item.document_url}
                </Text>
              </TouchableOpacity>
              {item.feedback ? (
                <Text className="mt-2 text-xs text-gray-400">Feedback: {item.feedback}</Text>
              ) : null}
              {typeof item.score === 'number' ? (
                <Text className="mt-1 text-xs text-green-400">Score: {item.score}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DocumentSubmissionsScreen;
