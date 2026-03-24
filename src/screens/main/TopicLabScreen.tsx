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
    [availableTopics, selectedTopicId],
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

      const refinedTeamContext = [baseTeamContext, attemptHint]
        .filter(Boolean)
        .join(' ')
        .trim();

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

      <View className="flex-row items-center px-4 py-3 border-b border-white/10">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="text-white text-lg font-bold">Topic Lab</Text>
          <Text className="text-gray-500 text-xs mt-0.5">Generate, refine, and apply topic for this group</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-[#1A2332] rounded-2xl p-4 mb-4">
          <Text className="text-white text-base font-semibold mb-3">AI Topic Draft</Text>

          <View className="flex-row bg-[#243447] rounded-xl p-1 mb-3">
            <TouchableOpacity
              onPress={() => setMode('AUTO')}
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === 'AUTO' ? 'bg-[#7C3AED]' : ''}`}
              activeOpacity={0.8}
            >
              <Text className={`text-xs font-semibold ${mode === 'AUTO' ? 'text-white' : 'text-gray-400'}`}>
                Auto Generate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('REFINE')}
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === 'REFINE' ? 'bg-[#7C3AED]' : ''}`}
              activeOpacity={0.8}
            >
              <Text className={`text-xs font-semibold ${mode === 'REFINE' ? 'text-white' : 'text-gray-400'}`}>
                Refine Seed
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="text-gray-400 text-xs mb-1">Seed Topic {mode === 'REFINE' ? '*' : '(optional)'}</Text>
          <TextInput
            value={seedName}
            onChangeText={setSeedName}
            placeholder="e.g. Smart Lab Resource Booking"
            placeholderTextColor="#64748B"
            className="bg-[#243447] rounded-xl px-4 h-11 text-white text-sm mb-3"
          />

          <Text className="text-gray-400 text-xs mb-1">Project Domain (optional)</Text>
          <TextInput
            value={projectDomain}
            onChangeText={setProjectDomain}
            placeholder="e.g. Education, Healthcare, Logistics"
            placeholderTextColor="#64748B"
            className="bg-[#243447] rounded-xl px-4 h-11 text-white text-sm mb-3"
          />

          <Text className="text-gray-400 text-xs mb-1">Team Context (optional)</Text>
          <TextInput
            value={teamContext}
            onChangeText={setTeamContext}
            placeholder="e.g. Team of 5 with mobile + backend skills"
            placeholderTextColor="#64748B"
            className="bg-[#243447] rounded-xl px-4 h-11 text-white text-sm mb-3"
          />

          <Text className="text-gray-400 text-xs mb-1">Problem Space (optional)</Text>
          <TextInput
            value={problemSpace}
            onChangeText={setProblemSpace}
            placeholder="e.g. Manual tracking and fragmented project updates"
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="bg-[#243447] rounded-xl px-4 py-3 text-white text-sm min-h-[84px] mb-3"
          />

          <Text className="text-gray-400 text-xs mb-1">Primary Actors Hint (optional)</Text>
          <TextInput
            value={primaryActorsHint}
            onChangeText={setPrimaryActorsHint}
            placeholder="e.g. Team Leader, Student, Lecturer"
            placeholderTextColor="#64748B"
            className="bg-[#243447] rounded-xl px-4 h-11 text-white text-sm mb-4"
          />

          <TouchableOpacity
            onPress={handleGenerateDraft}
            disabled={generating}
            activeOpacity={0.8}
            className={`rounded-xl py-3.5 items-center ${generating ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Generate Draft</Text>
            )}
          </TouchableOpacity>
        </View>

        {draft && (
          <View className="bg-[#1A2332] rounded-2xl p-4 mb-4">
            <Text className="text-white text-base font-semibold mb-3">Generated Draft</Text>

            <View className="mb-3">
              <Text className="text-gray-500 text-[11px] uppercase mb-1">Topic Name</Text>
              <Text className="text-white text-sm font-semibold">{draft.topic_name}</Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-[11px] uppercase mb-1">Context</Text>
              <Text className="text-gray-300 text-sm leading-5">{draft.context}</Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-[11px] uppercase mb-1">Problem Statement</Text>
              <Text className="text-gray-300 text-sm leading-5">{draft.problem_statement}</Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-[11px] uppercase mb-1">Primary Actors</Text>
              <Text className="text-gray-300 text-sm leading-5">{draft.primary_actors}</Text>
            </View>

            <View className="mb-4">
              <Text className="text-gray-500 text-[11px] uppercase mb-1">Uniqueness Rationale</Text>
              <Text className="text-gray-300 text-sm leading-5">{draft.uniqueness_rationale}</Text>
            </View>

            <TouchableOpacity
              onPress={handleApplyDraft}
              disabled={applyingDraft}
              activeOpacity={0.8}
              className={`rounded-xl py-3.5 items-center ${applyingDraft ? 'bg-[#334155]' : 'bg-[#F59E0B]'}`}
            >
              {applyingDraft ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Create and Apply to Group</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View className="bg-[#1A2332] rounded-2xl p-4">
          <Text className="text-white text-base font-semibold mb-2">Available Topics</Text>
          <Text className="text-gray-500 text-xs mb-3">Pick an existing topic and apply directly to this group</Text>

          {loadingTopics ? (
            <ActivityIndicator size="small" color="#7C3AED" style={{ paddingVertical: 12 }} />
          ) : availableTopics.length === 0 ? (
            <Text className="text-gray-500 text-sm py-2">No available topics found.</Text>
          ) : (
            <View className="gap-2">
              {availableTopics.map((topic) => {
                const isSelected = selectedTopicId === topic.id;
                return (
                  <TouchableOpacity
                    key={topic.id}
                    onPress={() => setSelectedTopicId(topic.id)}
                    activeOpacity={0.8}
                    className={`rounded-xl p-3 border ${isSelected ? 'border-[#7C3AED] bg-[#7C3AED]/10' : 'border-white/10 bg-[#243447]'}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className={`text-sm font-semibold ${isSelected ? 'text-[#C4B5FD]' : 'text-white'}`} numberOfLines={1}>
                        {topic.name}
                      </Text>
                      {isSelected && <Feather name="check-circle" size={16} color="#7C3AED" />}
                    </View>
                    {!!topic.description && (
                      <Text className="text-gray-400 text-xs mt-1" numberOfLines={2}>
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
            className={`rounded-xl py-3.5 items-center mt-4 ${!selectedTopic || applyingExisting ? 'bg-[#334155]' : 'bg-[#0EA5E9]'}`}
          >
            {applyingExisting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Apply Selected Topic</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TopicLabScreen;
