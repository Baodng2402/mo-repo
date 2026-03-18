import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getGroupById } from '@/services/groupService';
import { showSuccess, showError } from '@/utils/toast';
import type { GroupDetail } from '@/types/group';
import type { MemberEvaluation } from '@/types/activity';
import type { RootStackParamList } from '@/navigation/AppNavigator';

// ==================== Helpers ====================

/** AsyncStorage key for saving evaluations per group */
const getStorageKey = (groupId: string) => `evaluation_${groupId}`;

// ==================== Component ====================

const EvaluationScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Evaluation'>>();
    const { groupId } = route.params;

    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [evaluations, setEvaluations] = useState<MemberEvaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ── Total percentage (should equal 100) ─────────
    const totalPercent = evaluations.reduce((sum, e) => sum + e.percentage, 0);
    const isValid = totalPercent === 100;

    // Check if any two members have the same percentage
    const hasDuplicates = evaluations.some(
        (e, i) =>
            e.percentage > 0 &&
            evaluations.findIndex(
                (other, j) => j !== i && other.percentage === e.percentage,
            ) !== -1,
    );

    // ── Load Data ───────────────────────────────────

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getGroupById(groupId);
            setGroup(data);

            // Load saved evaluations or initialize
            const saved = await AsyncStorage.getItem(getStorageKey(groupId));
            if (saved) {
                const parsed: MemberEvaluation[] = JSON.parse(saved);
                // Merge with current members (handle member changes)
                const merged = data.members.map((m) => {
                    const existing = parsed.find((e) => e.userId === m.id);
                    return {
                        userId: m.id,
                        fullName: m.full_name,
                        percentage: existing?.percentage ?? 0,
                    };
                });
                setEvaluations(merged);
            } else {
                // Initialize all members with 0%
                setEvaluations(
                    data.members.map((m) => ({
                        userId: m.id,
                        fullName: m.full_name,
                        percentage: 0,
                    })),
                );
            }
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to load group');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [groupId, navigation]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData]),
    );

    // ── Update Score ────────────────────────────────

    const updateScore = (userId: string, value: string) => {
        const num = parseInt(value, 10);
        const percentage = isNaN(num) ? 0 : Math.min(100, Math.max(0, num));

        setEvaluations((prev) =>
            prev.map((e) => (e.userId === userId ? { ...e, percentage } : e)),
        );
    };

    // ── Save ────────────────────────────────────────

    const handleSave = async () => {
        if (!isValid) {
            showError(`Total must be 100%. Currently: ${totalPercent}%`);
            return;
        }
        if (hasDuplicates) {
            showError('Each member must have a unique percentage');
            return;
        }

        try {
            setSaving(true);
            await AsyncStorage.setItem(
                getStorageKey(groupId),
                JSON.stringify(evaluations),
            );
            showSuccess('Evaluation saved successfully');
            navigation.goBack();
        } catch {
            showError('Failed to save evaluation');
        } finally {
            setSaving(false);
        }
    };

    // ── Loading State ───────────────────────────────

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
            </SafeAreaView>
        );
    }

    // ── Render ──────────────────────────────────────

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
                    <Text className="text-white text-lg font-bold">Evaluation</Text>
                    <Text className="text-gray-500 text-xs">
                        {group?.name} • Allocate 100% across members
                    </Text>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Info Card */}
                <View className="bg-[#1A2332] rounded-2xl p-4 mt-3 mb-4">
                    <View className="flex-row items-center gap-2 mb-2">
                        <MaterialIcons name="info-outline" size={16} color="#7C3AED" />
                        <Text className="text-white font-semibold text-sm">
                            How it works
                        </Text>
                    </View>
                    <Text className="text-gray-400 text-xs leading-5">
                        Assign a contribution percentage to each member. The total must
                        equal exactly 100%. No two members can have the same percentage.
                        This will be used to calculate individual scores for the final
                        evaluation board.
                    </Text>
                </View>

                {/* Total Progress Bar */}
                <View className="bg-[#1A2332] rounded-2xl p-4 mb-4">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-gray-400 text-sm">Total Allocated</Text>
                        <Text
                            className={`font-bold text-lg ${isValid
                                    ? 'text-green-400'
                                    : totalPercent > 100
                                        ? 'text-red-400'
                                        : 'text-yellow-400'
                                }`}
                        >
                            {totalPercent}%
                        </Text>
                    </View>
                    <View className="h-2 bg-[#243447] rounded-full overflow-hidden">
                        <View
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.min(totalPercent, 100)}%`,
                                backgroundColor: isValid
                                    ? '#22C55E'
                                    : totalPercent > 100
                                        ? '#EF4444'
                                        : '#EAB308',
                            }}
                        />
                    </View>
                    {hasDuplicates && (
                        <Text className="text-yellow-400 text-xs mt-2">
                            ⚠️ Duplicate percentages detected
                        </Text>
                    )}
                </View>

                {/* Member Score Inputs */}
                {evaluations.map((evaluation, index) => (
                    <View
                        key={evaluation.userId}
                        className="bg-[#1A2332] rounded-2xl p-4 mb-3"
                    >
                        <View className="flex-row items-center justify-between">
                            {/* Member Info */}
                            <View className="flex-row items-center flex-1">
                                <View className="w-10 h-10 rounded-full bg-[#243447] items-center justify-center">
                                    <Text className="text-white font-bold text-sm">
                                        {evaluation.fullName?.charAt(0)?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text
                                        className="text-white font-semibold text-sm"
                                        numberOfLines={1}
                                    >
                                        {evaluation.fullName}
                                    </Text>
                                    <Text className="text-gray-500 text-[10px] mt-0.5">
                                        Member {index + 1} of {evaluations.length}
                                    </Text>
                                </View>
                            </View>

                            {/* Percentage Input */}
                            <View className="flex-row items-center">
                                <TextInput
                                    value={
                                        evaluation.percentage === 0
                                            ? ''
                                            : String(evaluation.percentage)
                                    }
                                    onChangeText={(v) => updateScore(evaluation.userId, v)}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                    placeholder="0"
                                    placeholderTextColor="#475569"
                                    className="bg-[#243447] text-white text-center font-bold text-lg w-16 h-12 rounded-xl"
                                />
                                <Text className="text-gray-400 text-lg font-bold ml-1">%</Text>
                            </View>
                        </View>

                        {/* Score bar */}
                        <View className="mt-3 h-1.5 bg-[#243447] rounded-full overflow-hidden">
                            <View
                                className="h-full rounded-full bg-[#7C3AED]"
                                style={{
                                    width: `${Math.min(evaluation.percentage, 100)}%`,
                                }}
                            />
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Save Button */}
            <View className="px-4 pb-4 pt-2">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || !isValid || hasDuplicates}
                    activeOpacity={0.8}
                    className={`py-3.5 rounded-xl items-center justify-center flex-row gap-2 ${saving || !isValid || hasDuplicates
                            ? 'bg-[#334155]'
                            : 'bg-[#7C3AED]'
                        }`}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Feather name="save" size={18} color="#fff" />
                            <Text className="text-white font-bold text-base">
                                Save Evaluation
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default EvaluationScreen;
