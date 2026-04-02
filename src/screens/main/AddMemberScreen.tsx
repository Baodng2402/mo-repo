import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { addMember } from '@/services/groupService';
import { showSuccess, showError } from '@/utils/toast';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import type { MembershipRole } from '@/types/group';
import { addMemberSchema, getZodErrorMessage } from '@/utils/validation/formSchemas';

// ==================== Constants ====================

const ROLES: { label: string; value: MembershipRole; icon: string }[] = [
  { label: 'Member', value: 'MEMBER', icon: 'user' },
  { label: 'Mentor', value: 'MENTOR', icon: 'award' },
];

// ==================== Component ====================

const AddMemberScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddMember'>>();
  const { groupId } = route.params;

  const [userId, setUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<MembershipRole>('MEMBER');
  const [submitting, setSubmitting] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // ── Submit ──────────────────────────────────────

  const handleSubmit = async () => {
    const parsed = addMemberSchema.safeParse({ userId });
    if (!parsed.success) {
      showError(getZodErrorMessage(parsed.error));
      return;
    }

    try {
      setSubmitting(true);
      await addMember(groupId, {
        user_id: parsed.data.userId,
        role_in_group: selectedRole,
      });
      showSuccess('Member added successfully');
      navigation.goBack();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to add member';
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center border-b border-[#334155] px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="ml-3 text-lg font-bold text-white">Add Member</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <View className="flex-1 px-4 pt-6">
          {/* User ID Input */}
          <View className="mb-6">
            <View className="mb-2 flex-row items-center gap-1.5">
              <Feather name="user" size={14} color={inputFocused ? '#7C3AED' : '#64748B'} />
              <Text
                className={`text-sm font-medium ${
                  inputFocused ? 'text-[#7C3AED]' : 'text-gray-400'
                }`}>
                User ID <Text className="text-red-400">*</Text>
              </Text>
            </View>
            <TextInput
              value={userId}
              onChangeText={setUserId}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Enter UUID of the user to add"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
              className={`h-12 rounded-xl border bg-[#1A2332] px-4 text-sm text-white ${
                inputFocused ? 'border-[#7C3AED]' : 'border-[#334155]'
              }`}
            />
            <Text className="mt-1.5 text-xs text-gray-600">
              Ask the user for their account ID from Settings
            </Text>
          </View>

          {/* Role Selection */}
          <View className="mb-6">
            <View className="mb-3 flex-row items-center gap-1.5">
              <Feather name="shield" size={14} color="#64748B" />
              <Text className="text-sm font-medium text-gray-400">Role in Group</Text>
            </View>
            <View className="flex-row gap-2">
              {ROLES.map((role) => {
                const isSelected = selectedRole === role.value;
                return (
                  <TouchableOpacity
                    key={role.value}
                    onPress={() => setSelectedRole(role.value)}
                    activeOpacity={0.8}
                    className={`flex-1 items-center rounded-xl border py-3 ${
                      isSelected
                        ? 'border-[#7C3AED] bg-[#7C3AED]/15'
                        : 'border-[#334155] bg-[#1A2332]'
                    }`}>
                    <Feather
                      name={role.icon as any}
                      size={18}
                      color={isSelected ? '#7C3AED' : '#64748B'}
                    />
                    <Text
                      className={`mt-1 text-xs font-medium ${
                        isSelected ? 'text-[#7C3AED]' : 'text-gray-500'
                      }`}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View className="border-t border-[#334155] px-4 pb-4 pt-2">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !userId.trim()}
            activeOpacity={0.8}
            className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
              submitting || !userId.trim() ? 'bg-[#334155]' : 'bg-[#7C3AED]'
            }`}>
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="user-plus" size={18} color="#fff" />
                <Text className="text-base font-bold text-white">Add Member</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddMemberScreen;
