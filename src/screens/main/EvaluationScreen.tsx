import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { getGroupById } from '@/services/groupService';
import {
  listEvaluations,
  getEvaluation,
  createEvaluation,
  updateEvaluation,
  deleteEvaluation,
} from '@/services/evaluationService';
import type {
  EvaluationSummary,
  EvaluationDetail,
  ContributionInput,
} from '@/services/evaluationService';
import { useUserStore } from '../../utils/stores/userStore';
import { showSuccess, showError } from '@/utils/toast';
import type { GroupDetail } from '@/types/group';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import ConfirmModal from '@/components/ConfirmModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormContribution {
  user_id: string;
  full_name: string;
  contribution_percent: number;
  note: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const EvaluationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Evaluation'>>();
  const { groupId } = route.params;
  const currentUser = useUserStore((s) => s.userInfo);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Detail view
  const [selectedEval, setSelectedEval] = useState<EvaluationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form modal
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formContribs, setFormContribs] = useState<FormContribution[]>([]);

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isLeader =
    group?.members?.find((m) => m.id === currentUser?.id)?.role_in_group === 'LEADER';

  const totalPercent = formContribs.reduce((s, c) => s + c.contribution_percent, 0);
  const isFormValid = formTitle.trim().length > 0 && Math.abs(totalPercent - 100) <= 0.05;

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupData, evalData] = await Promise.all([
        getGroupById(groupId),
        listEvaluations(groupId),
      ]);
      setGroup(groupData);
      setEvaluations(evalData.data);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      setSelectedEval(null);
    }, [loadData])
  );

  // ── Detail ────────────────────────────────────────────────────────────────

  const openDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const detail = await getEvaluation(id);
      setSelectedEval(detail);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load evaluation');
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    if (!group) return;
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormContribs(
      group.members.map((m) => ({
        user_id: m.id,
        full_name: m.full_name,
        contribution_percent: 0,
        note: '',
      }))
    );
    setFormVisible(true);
  };

  const openEditForm = (detail: EvaluationDetail) => {
    if (!group) return;
    setEditingId(detail.id);
    setFormTitle(detail.title);
    setFormDesc(detail.description || '');
    setFormContribs(
      group.members.map((m) => {
        const existing = detail.contributions.find((c) => c.user_id === m.id);
        return {
          user_id: m.id,
          full_name: m.full_name,
          contribution_percent: existing?.contribution_percent ?? 0,
          note: existing?.note || '',
        };
      })
    );
    setFormVisible(true);
  };

  const updatePercent = (userId: string, value: string) => {
    const num = parseFloat(value);
    const pct = isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
    setFormContribs((prev) =>
      prev.map((c) => (c.user_id === userId ? { ...c, contribution_percent: pct } : c))
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!isFormValid) return;

    const contributions: ContributionInput[] = formContribs.map((c) => ({
      user_id: c.user_id,
      contribution_percent: c.contribution_percent,
      note: c.note || undefined,
    }));

    try {
      setSaving(true);
      if (editingId) {
        const updated = await updateEvaluation(editingId, {
          title: formTitle,
          description: formDesc || undefined,
          contributions,
        });
        setEvaluations((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
        if (selectedEval?.id === editingId) setSelectedEval(updated);
        showSuccess('Evaluation updated');
      } else {
        const created = await createEvaluation({
          group_id: groupId,
          title: formTitle,
          description: formDesc || undefined,
          contributions,
        });
        setEvaluations((prev) => [created, ...prev]);
        showSuccess('Evaluation created');
      }
      setFormVisible(false);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      await deleteEvaluation(confirmDelete);
      setEvaluations((prev) => prev.filter((e) => e.id !== confirmDelete));
      if (selectedEval?.id === confirmDelete) setSelectedEval(null);
      showSuccess('Evaluation deleted');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete evaluation');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  // ── Detail View ───────────────────────────────────────────────────────────

  if (selectedEval) {
    return (
      <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#101922" />

        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => setSelectedEval(null)}
            className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <Text className="text-lg font-bold text-white" numberOfLines={1}>
              {selectedEval.title}
            </Text>
            <Text className="text-xs text-gray-500">
              by {selectedEval.created_by.full_name} ·{' '}
              {new Date(selectedEval.created_at).toLocaleDateString()}
            </Text>
          </View>
          {isLeader && (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => openEditForm(selectedEval)}
                className="h-9 w-9 items-center justify-center rounded-xl bg-[#1A2332]">
                <Feather name="edit-2" size={16} color="#7C3AED" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setConfirmDelete(selectedEval.id)}
                className="h-9 w-9 items-center justify-center rounded-xl bg-[#1A2332]">
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}>
          {/* Description */}
          {selectedEval.description ? (
            <View className="mb-4 mt-3 rounded-2xl bg-[#1A2332] p-4">
              <Text className="text-sm leading-5 text-gray-400">{selectedEval.description}</Text>
            </View>
          ) : null}

          {/* Contributions */}
          <Text className="mb-3 mt-1 text-xs uppercase tracking-wider text-gray-400">
            Contribution Split
          </Text>
          {selectedEval.contributions
            .slice()
            .sort((a, b) => b.contribution_percent - a.contribution_percent)
            .map((c) => (
              <View key={c.user_id} className="mb-3 rounded-2xl bg-[#1A2332] p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-[#243447]">
                      <Text className="text-sm font-bold text-white">
                        {c.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                        {c.full_name || 'Unknown'}
                      </Text>
                      {c.note ? (
                        <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                          {c.note}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text className="ml-2 text-lg font-bold text-[#7C3AED]">
                    {c.contribution_percent}%
                  </Text>
                </View>
                <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#243447]">
                  <View
                    className="h-full rounded-full bg-[#7C3AED]"
                    style={{ width: `${Math.min(c.contribution_percent, 100)}%` }}
                  />
                </View>
              </View>
            ))}
        </ScrollView>

        <EvalFormModal
          visible={formVisible}
          editingId={editingId}
          title={formTitle}
          desc={formDesc}
          contribs={formContribs}
          totalPercent={totalPercent}
          isFormValid={isFormValid}
          saving={saving}
          onChangeTitle={setFormTitle}
          onChangeDesc={setFormDesc}
          onChangePercent={updatePercent}
          onSave={handleSave}
          onClose={() => setFormVisible(false)}
        />

        <ConfirmModal
          visible={!!confirmDelete}
          title="Delete Evaluation"
          message="This action cannot be undone. All contribution data will be permanently removed."
          confirmLabel="Delete"
          variant="danger"
          icon="trash-2"
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      </SafeAreaView>
    );
  }

  // ── List View ─────────────────────────────────────────────────────────────

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
          <Text className="text-lg font-bold text-white">Evaluations</Text>
          <Text className="text-xs text-gray-500">{group?.name}</Text>
        </View>
        {isLeader && (
          <TouchableOpacity
            onPress={openCreateForm}
            className="flex-row items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-2">
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-xs font-semibold text-white">New</Text>
          </TouchableOpacity>
        )}
      </View>

      {loadingDetail && (
        <View className="absolute inset-0 z-10 items-center justify-center bg-black/40">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      )}

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {evaluations.length === 0 ? (
          <View className="mt-24 items-center justify-center gap-3">
            <MaterialIcons name="assessment" size={48} color="#334155" />
            <Text className="text-center text-sm text-gray-600">
              No evaluations yet.
              {isLeader ? '\nTap "New" to create one.' : ''}
            </Text>
          </View>
        ) : (
          evaluations.map((e) => (
            <TouchableOpacity
              key={e.id}
              onPress={() => openDetail(e.id)}
              activeOpacity={0.75}
              className="mb-3 rounded-2xl bg-[#1A2332] p-4">
              <View className="flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>
                    {e.title}
                  </Text>
                  {e.description ? (
                    <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
                      {e.description}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color="#475569" />
              </View>
              <View className="mt-3 flex-row items-center gap-2">
                <View className="h-5 w-5 items-center justify-center rounded-full bg-[#243447]">
                  <Text className="text-[9px] font-bold text-white">
                    {e.created_by.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">{e.created_by.full_name}</Text>
                <Text className="text-xs text-gray-700">·</Text>
                <Text className="text-xs text-gray-500">
                  {new Date(e.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <EvalFormModal
        visible={formVisible}
        editingId={editingId}
        title={formTitle}
        desc={formDesc}
        contribs={formContribs}
        totalPercent={totalPercent}
        isFormValid={isFormValid}
        saving={saving}
        onChangeTitle={setFormTitle}
        onChangeDesc={setFormDesc}
        onChangePercent={updatePercent}
        onSave={handleSave}
        onClose={() => setFormVisible(false)}
      />

      <ConfirmModal
        visible={!!confirmDelete}
        title="Delete Evaluation"
        message="This action cannot be undone. All contribution data will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        icon="trash-2"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </SafeAreaView>
  );
};

// ── Form Modal ─────────────────────────────────────────────────────────────────

interface EvalFormModalProps {
  visible: boolean;
  editingId: string | null;
  title: string;
  desc: string;
  contribs: FormContribution[];
  totalPercent: number;
  isFormValid: boolean;
  saving: boolean;
  onChangeTitle: (v: string) => void;
  onChangeDesc: (v: string) => void;
  onChangePercent: (userId: string, v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const EvalFormModal = ({
  visible,
  editingId,
  title,
  desc,
  contribs,
  totalPercent,
  isFormValid,
  saving,
  onChangeTitle,
  onChangeDesc,
  onChangePercent,
  onSave,
  onClose,
}: EvalFormModalProps) => {
  const roundedTotal = Math.round(totalPercent * 100) / 100;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end">
        <View className="rounded-t-3xl bg-[#101922]" style={{ maxHeight: '92%' }}>
          {/* Handle */}
          <View className="items-center pb-1 pt-3">
            <View className="h-1 w-10 rounded-full bg-[#243447]" />
          </View>

          {/* Modal Header */}
          <View className="flex-row items-center justify-between border-b border-white/5 px-4 py-3">
            <Text className="text-base font-bold text-white">
              {editingId ? 'Edit Evaluation' : 'New Evaluation'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="px-4"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text className="mb-1.5 mt-4 text-xs uppercase tracking-wider text-gray-400">
              Title *
            </Text>
            <TextInput
              value={title}
              onChangeText={onChangeTitle}
              placeholder="e.g. Sprint 3 Evaluation"
              placeholderTextColor="#475569"
              maxLength={200}
              className="rounded-xl bg-[#1A2332] px-4 py-3 text-sm text-white"
            />

            {/* Description */}
            <Text className="mb-1.5 mt-4 text-xs uppercase tracking-wider text-gray-400">
              Description (optional)
            </Text>
            <TextInput
              value={desc}
              onChangeText={onChangeDesc}
              placeholder="Notes about this evaluation..."
              placeholderTextColor="#475569"
              maxLength={1000}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="rounded-xl bg-[#1A2332] px-4 py-3 text-sm text-white"
              style={{ minHeight: 72 }}
            />

            {/* Total Progress */}
            <View className="mt-4 rounded-2xl bg-[#1A2332] p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm text-gray-400">Total Allocated</Text>
                <Text
                  className={`text-lg font-bold ${
                    Math.abs(roundedTotal - 100) <= 0.05
                      ? 'text-green-400'
                      : roundedTotal > 100
                        ? 'text-red-400'
                        : 'text-yellow-400'
                  }`}>
                  {roundedTotal}%
                </Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-[#243447]">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(roundedTotal, 100)}%`,
                    backgroundColor:
                      Math.abs(roundedTotal - 100) <= 0.05
                        ? '#22C55E'
                        : roundedTotal > 100
                          ? '#EF4444'
                          : '#EAB308',
                  }}
                />
              </View>
            </View>

            {/* Member inputs */}
            <Text className="mb-2 mt-4 text-xs uppercase tracking-wider text-gray-400">
              Contributions (must total 100%)
            </Text>
            {contribs.map((c) => (
              <View key={c.user_id} className="mb-2 rounded-2xl bg-[#1A2332] p-3">
                <View className="flex-row items-center">
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-[#243447]">
                    <Text className="text-sm font-bold text-white">
                      {c.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <Text className="ml-3 flex-1 text-sm font-medium text-white" numberOfLines={1}>
                    {c.full_name}
                  </Text>
                  <View className="flex-row items-center">
                    <TextInput
                      value={c.contribution_percent === 0 ? '' : String(c.contribution_percent)}
                      onChangeText={(v) => onChangePercent(c.user_id, v)}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      placeholder="0"
                      placeholderTextColor="#475569"
                      className="h-10 w-16 rounded-xl bg-[#243447] text-center text-base font-bold text-white"
                    />
                    <Text className="ml-1 text-base font-bold text-gray-400">%</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Save button */}
          <View className="border-t border-white/5 px-4 pb-6 pt-2">
            <TouchableOpacity
              onPress={onSave}
              disabled={saving || !isFormValid}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                saving || !isFormValid ? 'bg-[#334155]' : 'bg-[#7C3AED]'
              }`}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="save" size={16} color="#fff" />
                  <Text className="text-sm font-bold text-white">
                    {editingId ? 'Update Evaluation' : 'Create Evaluation'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default EvaluationScreen;
