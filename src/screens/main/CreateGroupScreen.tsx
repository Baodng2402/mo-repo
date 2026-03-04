import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StatusBar,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Modal,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { createGroup, updateGroup, getGroupById } from '@/services/groupService';
import { getRepositories, type GitHubRepo } from '@/services/githubService';
import { showSuccess, showError } from '@/utils/toast';
import type { RootStackParamList } from '@/navigation/AppNavigator';

// ==================== Types ====================

interface FormField {
    key: string;
    label: string;
    placeholder: string;
    required?: boolean;
    multiline?: boolean;
    maxLength?: number;
    icon: string;
    isSelect?: boolean;
}

// ==================== Constants ====================

const FORM_FIELDS: FormField[] = [
    {
        key: 'name',
        label: 'Group Name',
        placeholder: 'e.g. Team Alpha',
        required: true,
        maxLength: 100,
        icon: 'users',
    },
    {
        key: 'project_name',
        label: 'Project Name',
        placeholder: 'e.g. E-Commerce Platform',
        maxLength: 100,
        icon: 'briefcase',
    },
    {
        key: 'description',
        label: 'Description',
        placeholder: 'Briefly describe your group or project...',
        multiline: true,
        maxLength: 500,
        icon: 'align-left',
    },
    {
        key: 'semester',
        label: 'Semester',
        placeholder: 'e.g. HK2-2025',
        maxLength: 20,
        icon: 'calendar',
    },
    {
        key: 'github_repo_url',
        label: 'GitHub Repository URL',
        placeholder: 'https://github.com/org/repo',
        maxLength: 255,
        icon: 'github',
        isSelect: true,
    },
    {
        key: 'jira_project_key',
        label: 'Jira Project Key',
        placeholder: 'e.g. ECOM',
        maxLength: 50,
        icon: 'trello',
    },
];

type FormData = Record<string, string>;

// ==================== Component ====================

const CreateGroupScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'EditGroup'>>();

    // If groupId exists, we are in edit mode
    const editGroupId = route.params?.groupId;
    const isEditMode = !!editGroupId;

    const [formData, setFormData] = useState<FormData>({});
    const [submitting, setSubmitting] = useState(false);
    const [loadingGroup, setLoadingGroup] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [loadingRepos, setLoadingRepos] = useState(false);
    const [isRepoModalVisible, setRepoModalVisible] = useState(false);

    // ── Load User Repositories ──────────────

    useEffect(() => {
        if (isEditMode && editGroupId) {
            const loadGroup = async () => {
                try {
                    setLoadingGroup(true);
                    const group = await getGroupById(editGroupId);
                    setFormData({
                        name: group.name || '',
                        project_name: group.project_name || '',
                        description: group.description || '',
                        semester: group.semester || '',
                        github_repo_url: group.github_repo_url || '',
                        jira_project_key: group.jira_project_key || '',
                    });
                } catch (error: any) {
                    showError(error.response?.data?.message || 'Failed to load group');
                    navigation.goBack();
                } finally {
                    setLoadingGroup(false);
                }
            };
            loadGroup();
        }
    }, [isEditMode, editGroupId, navigation]);

    useEffect(() => {
        const fetchRepos = async () => {
            try {
                setLoadingRepos(true);
                const data = await getRepositories();
                setRepos(data.repositories || []);
            } catch (error) {
                console.error('Failed to load GitHub repos:', error);
                // Non-blocking error, user can still type or skip if they want
            } finally {
                setLoadingRepos(false);
            }
        };
        fetchRepos();
    }, []);

    // ── Submit ──────────────────────────────────────

    const handleSubmit = async () => {
        if (!formData.name?.trim()) {
            showError('Group name is required');
            return;
        }

        // Build clean payload (remove empty strings)
        const payload: Record<string, string> = {};
        for (const [key, value] of Object.entries(formData)) {
            if (value?.trim()) {
                payload[key] = value.trim();
            }
        }

        try {
            setSubmitting(true);

            if (isEditMode && editGroupId) {
                await updateGroup(editGroupId, payload);
                showSuccess('Group updated successfully');
            } else {
                await createGroup(payload as any);
                showSuccess('Group created successfully');
            }

            navigation.goBack();
        } catch (error: any) {
            const message =
                error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} group`;
            showError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = (key: string, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    // ── Render ──────────────────────────────────────

    if (loadingGroup) {
        return (
            <SafeAreaView className="flex-1 bg-[#101922] items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center rounded-xl bg-[#1A2332]"
                >
                    <Feather name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold ml-3">
                    {isEditMode ? 'Edit Group' : 'Create Group'}
                </Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingVertical: 16, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {FORM_FIELDS.map((field) => {
                        const isFocused = focusedField === field.key;

                        return (
                            <View key={field.key} className="mb-4">
                                <View className="flex-row items-center gap-1.5 mb-2">
                                    <Feather
                                        name={field.icon as any}
                                        size={14}
                                        color={isFocused ? '#7C3AED' : '#64748B'}
                                    />
                                    <Text
                                        className={`text-sm font-medium ${isFocused ? 'text-[#7C3AED]' : 'text-gray-400'
                                            }`}
                                    >
                                        {field.label}
                                        {field.required && (
                                            <Text className="text-red-400"> *</Text>
                                        )}
                                    </Text>
                                </View>

                                <TextInput
                                    value={formData[field.key] || ''}
                                    onChangeText={(value) => updateField(field.key, value)}
                                    onFocus={() => setFocusedField(field.key)}
                                    onBlur={() => setFocusedField(null)}
                                    placeholder={field.placeholder}
                                    placeholderTextColor="#475569"
                                    maxLength={field.maxLength}
                                    multiline={field.multiline}
                                    numberOfLines={field.multiline ? 4 : 1}
                                    textAlignVertical={field.multiline ? 'top' : 'center'}
                                    className={`bg-[#1A2332] rounded-xl px-4 text-white text-sm border ${isFocused ? 'border-[#7C3AED]' : 'border-white/10'
                                        } ${field.multiline ? 'py-3 min-h-[100px]' : 'h-12'}`}
                                    autoCapitalize="none"
                                />

                                {field.isSelect && field.key === 'github_repo_url' && (
                                    <TouchableOpacity
                                        className="absolute inset-0"
                                        onPress={() => setRepoModalVisible(true)}
                                    />
                                )}

                                {field.maxLength && formData[field.key]?.length > 0 && !field.isSelect && (
                                    <Text className="text-gray-600 text-[10px] mt-1 text-right">
                                        {formData[field.key].length}/{field.maxLength}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Submit Button */}
                <View className="px-4 pb-4 pt-2 border-t border-white/10">
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting || !formData.name?.trim()}
                        activeOpacity={0.8}
                        className={`py-3.5 rounded-xl items-center justify-center flex-row gap-2 ${submitting || !formData.name?.trim()
                            ? 'bg-[#334155]'
                            : 'bg-[#7C3AED]'
                            }`}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Feather
                                    name={isEditMode ? 'check' : 'plus'}
                                    size={18}
                                    color="#fff"
                                />
                                <Text className="text-white font-bold text-base">
                                    {isEditMode ? 'Save Changes' : 'Create Group'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* GitHub Repo Selection Modal */}
            <Modal
                visible={isRepoModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setRepoModalVisible(false)}
            >
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-[#101922] rounded-t-3xl border-t border-white/10" style={{ maxHeight: '80%' }}>
                        <View className="flex-row justify-between items-center p-4 border-b border-white/10">
                            <Text className="text-white text-lg font-bold">Select Repository</Text>
                            <TouchableOpacity onPress={() => setRepoModalVisible(false)} className="p-2">
                                <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {loadingRepos ? (
                            <View className="py-10 items-center justify-center">
                                <ActivityIndicator size="large" color="#7C3AED" />
                            </View>
                        ) : (
                            <FlatList
                                data={[{ id: -1, name: 'None', html_url: '' } as any, ...repos]}
                                keyExtractor={(item) => item.id.toString()}
                                contentContainerStyle={{ padding: 16 }}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => {
                                            updateField('github_repo_url', item.html_url);
                                            setRepoModalVisible(false);
                                        }}
                                        className="py-4 border-b border-white/5 flex-row items-center justify-between"
                                    >
                                        <Text className={`text-base ${item.id === -1 ? 'text-gray-400 italic' : 'text-white'}`}>
                                            {item.name}
                                        </Text>
                                        {formData['github_repo_url'] === item.html_url && (
                                            <Feather name="check" size={20} color="#7C3AED" />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default CreateGroupScreen;
