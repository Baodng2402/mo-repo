import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Feather } from '@/components/icons';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { showError, showSuccess } from '@/utils/toast';
import { updateGroup } from '@/services/groupService';
import {
  createTopicFromAi,
  generateTopicIdea,
  type GenerateTopicIdeaPayload,
  getAvailableTopics,
  type TopicDraft,
  type TopicIdeaMode,
  type TopicItem,
} from '@/services/topicService';

const MAX_GENERATE_RETRIES = 2;

const getErrorMessage = (error: any): string => {
  const message = error?.response?.data?.message;

  if (Array.isArray(message)) {
    return message.join(', ');
  }

  if (typeof message === 'string') {
    return message;
  }

  return 'Failed to generate topic draft';
};

const isDuplicateDraftError = (error: any): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('duplicated') || message.includes('already exists');
};

const TopicLabScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TopicLab'>>();
  const { groupId } = route.params;

  const [mode, setMode] = useState<TopicIdeaMode>('AUTO');
  const [seedName, setSeedName] = useState('');
  const [projectDomain, setProjectDomain] = useState('');
  const [teamContext, setTeamContext] = useState('');
  const [problemSpace, setProblemSpace] = useState('');
  const [primaryActorsHint, setPrimaryActorsHint] = useState('');

  const [draft, setDraft] = useState<TopicDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [applyingDraft, setApplyingDraft] = useState(false);

  const [availableTopics, setAvailableTopics] = useState<TopicItem[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [applyingExisting, setApplyingExisting] = useState(false);

  const fetchAvailableTopics = useCallback(async () => {
    try {
      setLoadingTopics(true);
      const topics = await getAvailableTopics();
      setAvailableTopics(topics || []);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to load available topics');
      setAvailableTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableTopics();
  }, [fetchAvailableTopics]);

  const selectedTopic = useMemo(
    () => availableTopics.find((topic) => topic.id === selectedTopicId) || null,
    [availableTopics, selectedTopicId]
  );

  const handleGenerateDraft = async () => {
    if (mode === 'REFINE' && !seedName.trim()) {
      showError('Seed topic is required in refine mode');
      return;
    }

    const buildPayload = (attempt: number): GenerateTopicIdeaPayload => {
      const baseTeamContext = teamContext.trim();
      const attemptHint =
        attempt > 0
          ? `Please provide a clearly distinct topic variation (attempt ${attempt + 1}).`
          : '';

      const refinedTeamContext = [baseTeamContext, attemptHint].filter(Boolean).join(' ').trim();

      return {
        mode,
        seed_name: seedName.trim() || undefined,
        project_domain: projectDomain.trim() || undefined,
        team_context: refinedTeamContext || undefined,
        problem_space: problemSpace.trim() || undefined,
        primary_actors_hint: primaryActorsHint.trim() || undefined,
      };
    };

    try {
      setGenerating(true);

      let nextDraft: TopicDraft | null = null;

      for (let attempt = 0; attempt <= MAX_GENERATE_RETRIES; attempt += 1) {
        try {
          nextDraft = await generateTopicIdea(buildPayload(attempt));
          break;
        } catch (error: any) {
          const shouldRetry = isDuplicateDraftError(error) && attempt < MAX_GENERATE_RETRIES;

          if (shouldRetry) {
            continue;
          }

          throw error;
        }
      }

      if (!nextDraft) {
        showError('Failed to generate a unique topic draft. Please adjust your hints and retry.');
        return;
      }

      setDraft(nextDraft);
      showSuccess('Topic draft generated successfully');
    } catch (error: any) {
      showError(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyDraft = async () => {
    if (!draft) return;

    try {
      setApplyingDraft(true);
      const created = await createTopicFromAi({
        topic_name: draft.topic_name,
        context: draft.context,
        problem_statement: draft.problem_statement,
        primary_actors: draft.primary_actors,
        uniqueness_rationale: draft.uniqueness_rationale,
      });

      await updateGroup(groupId, { topic_id: created.id });
      showSuccess('Topic applied to group successfully');
      navigation.goBack();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to apply generated topic');
    } finally {
      setApplyingDraft(false);
    }
  };

  const handleApplyExisting = async () => {
    if (!selectedTopicId) {
      showError('Please select a topic first');
      return;
    }

    try {
      setApplyingExisting(true);
      await updateGroup(groupId, { topic_id: selectedTopicId });
      showSuccess('Existing topic applied to group successfully');
      navigation.goBack();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to apply selected topic');
    } finally {
      setApplyingExisting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-bold text-white">Topic Lab</Text>
          <Text className="mt-0.5 text-xs text-gray-500">
            Generate, refine, and apply topic for this group
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}>
        <View className="mb-4 rounded-2xl bg-[#1A2332] p-4">
          <Text className="mb-3 text-base font-semibold text-white">AI Topic Draft</Text>

          <View className="mb-3 flex-row rounded-xl bg-[#243447] p-1">
            <TouchableOpacity
              onPress={() => setMode('AUTO')}
              className={`flex-1 items-center rounded-lg py-2.5 ${mode === 'AUTO' ? 'bg-[#7C3AED]' : ''}`}
              activeOpacity={0.8}>
              <Text
                className={`text-xs font-semibold ${mode === 'AUTO' ? 'text-white' : 'text-gray-400'}`}>
                Auto Generate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('REFINE')}
              className={`flex-1 items-center rounded-lg py-2.5 ${mode === 'REFINE' ? 'bg-[#7C3AED]' : ''}`}
              activeOpacity={0.8}>
              <Text
                className={`text-xs font-semibold ${mode === 'REFINE' ? 'text-white' : 'text-gray-400'}`}>
                Refine Seed
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="mb-1 text-xs text-gray-400">
            Seed Topic {mode === 'REFINE' ? '*' : '(optional)'}
          </Text>
          <TextInput
            value={seedName}
            onChangeText={setSeedName}
            placeholder="e.g. Smart Lab Resource Booking"
            placeholderTextColor="#64748B"
            className="mb-3 h-11 rounded-xl bg-[#243447] px-4 text-sm text-white"
          />

          <Text className="mb-1 text-xs text-gray-400">Project Domain (optional)</Text>
          <TextInput
            value={projectDomain}
            onChangeText={setProjectDomain}
            placeholder="e.g. Education, Healthcare, Logistics"
            placeholderTextColor="#64748B"
            className="mb-3 h-11 rounded-xl bg-[#243447] px-4 text-sm text-white"
          />

          <Text className="mb-1 text-xs text-gray-400">Team Context (optional)</Text>
          <TextInput
            value={teamContext}
            onChangeText={setTeamContext}
            placeholder="e.g. Team of 5 with mobile + backend skills"
            placeholderTextColor="#64748B"
            className="mb-3 h-11 rounded-xl bg-[#243447] px-4 text-sm text-white"
          />

          <Text className="mb-1 text-xs text-gray-400">Problem Space (optional)</Text>
          <TextInput
            value={problemSpace}
            onChangeText={setProblemSpace}
            placeholder="e.g. Manual tracking and fragmented project updates"
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="mb-3 min-h-[84px] rounded-xl bg-[#243447] px-4 py-3 text-sm text-white"
          />

          <Text className="mb-1 text-xs text-gray-400">Primary Actors Hint (optional)</Text>
          <TextInput
            value={primaryActorsHint}
            onChangeText={setPrimaryActorsHint}
            placeholder="e.g. Team Leader, Student, Lecturer"
            placeholderTextColor="#64748B"
            className="mb-4 h-11 rounded-xl bg-[#243447] px-4 text-sm text-white"
          />

          <TouchableOpacity
            onPress={handleGenerateDraft}
            disabled={generating}
            activeOpacity={0.8}
            className={`items-center rounded-xl py-3.5 ${generating ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}>
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Generate Draft</Text>
            )}
          </TouchableOpacity>
        </View>

        {draft && (
          <View className="mb-4 rounded-2xl bg-[#1A2332] p-4">
            <Text className="mb-3 text-base font-semibold text-white">Generated Draft</Text>

            <View className="mb-3">
              <Text className="mb-1 text-[11px] uppercase text-gray-500">Topic Name</Text>
              <Text className="text-sm font-semibold text-white">{draft.topic_name}</Text>
            </View>

            <View className="mb-3">
              <Text className="mb-1 text-[11px] uppercase text-gray-500">Context</Text>
              <Text className="text-sm leading-5 text-gray-300">{draft.context}</Text>
            </View>

            <View className="mb-3">
              <Text className="mb-1 text-[11px] uppercase text-gray-500">Problem Statement</Text>
              <Text className="text-sm leading-5 text-gray-300">{draft.problem_statement}</Text>
            </View>

            <View className="mb-3">
              <Text className="mb-1 text-[11px] uppercase text-gray-500">Primary Actors</Text>
              <Text className="text-sm leading-5 text-gray-300">{draft.primary_actors}</Text>
            </View>

            <View className="mb-4">
              <Text className="mb-1 text-[11px] uppercase text-gray-500">Uniqueness Rationale</Text>
              <Text className="text-sm leading-5 text-gray-300">{draft.uniqueness_rationale}</Text>
            </View>

            <TouchableOpacity
              onPress={handleApplyDraft}
              disabled={applyingDraft}
              activeOpacity={0.8}
              className={`items-center rounded-xl py-3.5 ${applyingDraft ? 'bg-[#334155]' : 'bg-[#F59E0B]'}`}>
              {applyingDraft ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="font-semibold text-white">Create and Apply to Group</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View className="rounded-2xl bg-[#1A2332] p-4">
          <Text className="mb-2 text-base font-semibold text-white">Available Topics</Text>
          <Text className="mb-3 text-xs text-gray-500">
            Pick an existing topic and apply directly to this group
          </Text>

          {loadingTopics ? (
            <ActivityIndicator size="small" color="#7C3AED" style={{ paddingVertical: 12 }} />
          ) : availableTopics.length === 0 ? (
            <Text className="py-2 text-sm text-gray-500">No available topics found.</Text>
          ) : (
            <View className="gap-2">
              {availableTopics.map((topic) => {
                const isSelected = selectedTopicId === topic.id;
                return (
                  <TouchableOpacity
                    key={topic.id}
                    onPress={() => setSelectedTopicId(topic.id)}
                    activeOpacity={0.8}
                    className={`rounded-xl border p-3 ${isSelected ? 'border-[#7C3AED] bg-[#7C3AED]/10' : 'border-white/10 bg-[#243447]'}`}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-sm font-semibold ${isSelected ? 'text-[#C4B5FD]' : 'text-white'}`}
                        numberOfLines={1}>
                        {topic.name}
                      </Text>
                      {isSelected && <Feather name="check-circle" size={16} color="#7C3AED" />}
                    </View>
                    {!!topic.description && (
                      <Text className="mt-1 text-xs text-gray-400" numberOfLines={2}>
                        {topic.description}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            onPress={handleApplyExisting}
            disabled={!selectedTopic || applyingExisting}
            activeOpacity={0.8}
            className={`mt-4 items-center rounded-xl py-3.5 ${!selectedTopic || applyingExisting ? 'bg-[#334155]' : 'bg-[#0EA5E9]'}`}>
            {applyingExisting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Apply Selected Topic</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TopicLabScreen;
