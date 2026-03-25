import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import {
  getCurrentWeek,
  getStudentWarnings,
  getStudentReviewStatus,
  type SerializedSemester,
  type StudentWarning,
  type ComplianceClassSummary,
  type ReviewGroup,
  type ReviewMilestoneContext,
} from '@/services/semesterService';
import type { RootStackParamList } from '@/navigation/AppNavigator';

// ── Helpers ────────────────────────────────────────────────────────────────────

const MILESTONE_LABELS: Record<string, string> = {
  REVIEW_1: 'Review 1',
  PROGRESS_TRACKING: 'Progress Tracking',
  REVIEW_2: 'Review 2',
  REVIEW_3: 'Review 3',
};

const WARNING_COLORS: Record<string, string> = {
  WEEK1_NO_GROUP: '#EAB308',
  WEEK2_TOPIC_NOT_FINALIZED: '#F97316',
};

const WARNING_ICONS: Record<string, string> = {
  WEEK1_NO_GROUP: 'users',
  WEEK2_TOPIC_NOT_FINALIZED: 'book-open',
};

const WEEK_STATUS_COLOR = (status: 'PASS' | 'FAIL') =>
  status === 'PASS' ? '#22C55E' : '#EF4444';

// ── Component ──────────────────────────────────────────────────────────────────

const SemesterStatusScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SemesterStatus'>>();
  const { groupId } = route.params;

  const [loading, setLoading] = useState(true);
  const [semester, setSemester] = useState<SerializedSemester | null>(null);
  const [warnings, setWarnings] = useState<StudentWarning[]>([]);
  const [complianceClasses, setComplianceClasses] = useState<ComplianceClassSummary[]>([]);
  const [milestone, setMilestone] = useState<ReviewMilestoneContext | null>(null);
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [weekRes, warningRes, reviewRes] = await Promise.allSettled([
        getCurrentWeek(),
        getStudentWarnings(),
        getStudentReviewStatus(),
      ]);

      if (weekRes.status === 'fulfilled') {
        setSemester(weekRes.value.semester);
      }
      if (warningRes.status === 'fulfilled') {
        // Only keep the class that contains this specific group
        const filteredClasses = warningRes.value.classes
          .filter((cls) => cls.groups.some((g) => g.group_id === groupId))
          .map((cls) => ({
            ...cls,
            groups: cls.groups.filter((g) => g.group_id === groupId),
          }));

        // Only keep warnings that explicitly belong to this group
        const filteredWarnings = warningRes.value.warnings.filter(
          (w) => w.group_id === groupId,
        );

        setWarnings(filteredWarnings);
        setComplianceClasses(filteredClasses);
        if (!semester && warningRes.value.semester) {
          setSemester(warningRes.value.semester);
        }
      }
      if (reviewRes.status === 'fulfilled') {
        setMilestone(reviewRes.value.milestone);
        // Only show review for this specific group
        setReviewGroups(reviewRes.value.groups.filter((g) => g.group_id === groupId));
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  // ── No semester ───────────────────────────────────────────────────────────────

  if (!semester) {
    return (
      <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#101922" />
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold ml-3">Semester Status</Text>
        </View>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <MaterialIcons name="school" size={52} color="#334155" />
          <Text className="text-gray-500 text-base text-center">
            No active semester found.
          </Text>
          <Text className="text-gray-600 text-sm text-center">
            Check back when a new semester starts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    semester.status === 'ACTIVE'
      ? '#22C55E'
      : semester.status === 'UPCOMING'
        ? '#EAB308'
        : '#64748B';

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1 ml-3">
          <Text className="text-white text-lg font-bold">Semester Status</Text>
          <Text className="text-gray-500 text-xs">{semester.name}</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Semester Info Card ──────────────────────────────── */}
        <View className="bg-[#1A2332] rounded-2xl p-4 mt-2 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <Text className="text-white font-bold text-base">{semester.code}</Text>
            </View>
            <View
              className="px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: `${statusColor}20` }}
            >
              <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                {semester.status}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-4">
            <View className="flex-1">
              <Text className="text-gray-500 text-xs mb-0.5">Current Week</Text>
              <Text className="text-white font-bold text-2xl">
                Week {semester.current_week}
                <Text className="text-gray-500 text-base font-normal"> / 10</Text>
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs mb-0.5">Period</Text>
              <Text className="text-gray-300 text-xs">
                {new Date(semester.start_date).toLocaleDateString()} –
              </Text>
              <Text className="text-gray-300 text-xs">
                {new Date(semester.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Week progress bar */}
          <View className="mt-3">
            <View className="h-2 bg-[#243447] rounded-full overflow-hidden">
              <View
                className="h-full rounded-full bg-[#7C3AED]"
                style={{ width: `${Math.min((semester.current_week / 10) * 100, 100)}%` }}
              />
            </View>
          </View>
        </View>

        {/* ── Active Warnings ─────────────────────────────────── */}
        {warnings.length > 0 && (
          <View className="mb-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              Action Required
            </Text>
            {warnings.map((w, i) => (
              <View
                key={i}
                className="rounded-2xl p-4 mb-2 flex-row items-start gap-3"
                style={{ backgroundColor: `${WARNING_COLORS[w.code] || '#EAB308'}18` }}
              >
                <Feather
                  name={(WARNING_ICONS[w.code] || 'alert-triangle') as any}
                  size={18}
                  color={WARNING_COLORS[w.code] || '#EAB308'}
                />
                <View className="flex-1">
                  <Text
                    className="font-semibold text-sm mb-0.5"
                    style={{ color: WARNING_COLORS[w.code] || '#EAB308' }}
                  >
                    {w.class_code}
                    {w.group_name ? ` · ${w.group_name}` : ''}
                  </Text>
                  <Text className="text-gray-300 text-xs leading-4">{w.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Compliance / Week Checkpoints ───────────────────── */}
        {complianceClasses.length > 0 && (
          <View className="mb-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              Weekly Checkpoints
            </Text>
            {complianceClasses.map((cls) => (
              <View key={cls.class_id} className="bg-[#1A2332] rounded-2xl p-4 mb-3">
                <Text className="text-white font-bold text-sm mb-3">
                  {cls.class_code}
                  <Text className="text-gray-500 font-normal"> · {cls.class_name}</Text>
                </Text>

                {/* Week 1 checkpoint */}
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Feather
                      name={cls.week1_status === 'PASS' ? 'check-circle' : 'circle'}
                      size={16}
                      color={WEEK_STATUS_COLOR(cls.week1_status)}
                    />
                    <Text className="text-gray-300 text-sm">Week 1 · Joined a group</Text>
                  </View>
                  <Text
                    className="text-xs font-bold"
                    style={{ color: WEEK_STATUS_COLOR(cls.week1_status) }}
                  >
                    {cls.week1_status}
                  </Text>
                </View>

                {/* Week 2 per group */}
                {cls.groups.map((g) => (
                  <View
                    key={g.group_id}
                    className="flex-row items-center justify-between mb-2 pl-2"
                  >
                    <View className="flex-row items-center gap-2 flex-1">
                      <Feather
                        name={g.week2_status === 'PASS' ? 'check-circle' : 'circle'}
                        size={16}
                        color={WEEK_STATUS_COLOR(g.week2_status)}
                      />
                      <View className="flex-1">
                        <Text className="text-gray-300 text-sm" numberOfLines={1}>
                          Week 2 · Topic finalized
                        </Text>
                        <Text className="text-gray-600 text-xs" numberOfLines={1}>
                          {g.group_name}
                          {g.topic_name ? ` · ${g.topic_name}` : ' · No topic yet'}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-xs font-bold ml-2"
                      style={{ color: WEEK_STATUS_COLOR(g.week2_status) }}
                    >
                      {g.week2_status}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── Review Milestone ────────────────────────────────── */}
        {milestone && reviewGroups.length > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-400 text-xs uppercase tracking-wider">
                Review Status
              </Text>
              <View className="bg-[#7C3AED]/20 px-2.5 py-1 rounded-lg">
                <Text className="text-[#7C3AED] text-xs font-semibold">
                  {MILESTONE_LABELS[milestone.code] || milestone.code}
                </Text>
              </View>
            </View>
            <Text className="text-gray-600 text-xs mb-3">
              Week {milestone.week_start}–{milestone.week_end}
            </Text>

            {reviewGroups.map((g) => (
              <ReviewGroupCard key={g.group_id} group={g} />
            ))}
          </View>
        )}

        {/* No data fallback */}
        {warnings.length === 0 && complianceClasses.length === 0 && !milestone && (
          <View className="items-center justify-center mt-16 gap-3">
            <Feather name="check-circle" size={44} color="#334155" />
            <Text className="text-gray-500 text-sm text-center">
              Everything looks good.
            </Text>
            <Text className="text-gray-600 text-xs text-center">
              No warnings or active review milestone this week.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Review Group Card ──────────────────────────────────────────────────────────

const ReviewGroupCard = ({ group }: { group: ReviewGroup }) => {
  const isReviewed = group.review_status === 'REVIEWED';
  const statusColor = isReviewed ? '#22C55E' : '#64748B';

  return (
    <View className="bg-[#1A2332] rounded-2xl p-4 mb-3">
      {/* Group header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {group.group_name}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
            {group.class_code} · {group.topic_name || 'No topic'}
          </Text>
        </View>
        <View
          className="px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: `${statusColor}20` }}
        >
          <Text className="text-xs font-semibold" style={{ color: statusColor }}>
            {isReviewed ? 'Reviewed' : 'Pending'}
          </Text>
        </View>
      </View>

      {isReviewed ? (
        <>
          {/* Scores */}
          <View className="flex-row gap-2 mb-3">
            <ScoreBadge label="Tasks" value={group.scores.task_progress_score} />
            <ScoreBadge label="Commits" value={group.scores.commit_contribution_score} />
            <ScoreBadge label="Milestone" value={group.scores.review_milestone_score} />
            {group.scores.total_score !== null && (
              <ScoreBadge label="Total" value={group.scores.total_score} highlight />
            )}
          </View>

          {/* Snapshot */}
          <View className="flex-row gap-4 bg-[#243447] rounded-xl p-3">
            <View className="items-center flex-1">
              <Text className="text-white font-bold text-base">
                {group.snapshot.task_done}/{group.snapshot.task_total}
              </Text>
              <Text className="text-gray-500 text-[10px] mt-0.5">Tasks Done</Text>
            </View>
            {group.snapshot.commit_total !== null && (
              <View className="items-center flex-1">
                <Text className="text-white font-bold text-base">
                  {group.snapshot.commit_total}
                </Text>
                <Text className="text-gray-500 text-[10px] mt-0.5">Commits</Text>
              </View>
            )}
            {group.snapshot.commit_contributors !== null && (
              <View className="items-center flex-1">
                <Text className="text-white font-bold text-base">
                  {group.snapshot.commit_contributors}
                </Text>
                <Text className="text-gray-500 text-[10px] mt-0.5">Contributors</Text>
              </View>
            )}
          </View>

          {/* Lecturer note */}
          {!!group.lecturer_note && (
            <View className="mt-3 bg-[#243447] rounded-xl p-3">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">
                Lecturer Note
              </Text>
              <Text className="text-gray-300 text-xs leading-4">{group.lecturer_note}</Text>
            </View>
          )}
        </>
      ) : (
        /* Pending state */
        <View className="flex-row items-center gap-2 bg-[#243447] rounded-xl p-3">
          <Feather name="clock" size={14} color="#64748B" />
          <Text className="text-gray-500 text-xs">
            Waiting for lecturer review this milestone.
          </Text>
        </View>
      )}

      {/* Warnings */}
      {group.warnings.filter((w) => w !== 'REVIEW_NOT_CAPTURED').length > 0 && (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {group.warnings
            .filter((w) => w !== 'REVIEW_NOT_CAPTURED')
            .map((w) => (
              <View key={w} className="bg-[#7C2D12]/30 px-2 py-0.5 rounded-md">
                <Text className="text-orange-300 text-[10px]">
                  {w === 'NO_TASK_EVIDENCE' ? 'No task evidence' : 'No commit evidence'}
                </Text>
              </View>
            ))}
        </View>
      )}
    </View>
  );
};

const ScoreBadge = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
}) => (
  <View
    className={`flex-1 items-center rounded-xl py-2 ${highlight ? 'bg-[#7C3AED]/20' : 'bg-[#243447]'}`}
  >
    <Text className={`font-bold text-sm ${highlight ? 'text-[#7C3AED]' : 'text-white'}`}>
      {value !== null ? value.toFixed(1) : '–'}
    </Text>
    <Text className="text-gray-500 text-[10px] mt-0.5">{label}</Text>
  </View>
);

export default SemesterStatusScreen;
