import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StatusBar,
    Switch,
    Modal,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserStore } from '@/utils/stores/userStore';
import { showSuccess } from '@/utils/toast';

// ==================== Memoized Components ====================

/** Reusable settings row item with icon, title, subtitle, and optional right element */
const SettingItem = React.memo(
    ({
        icon,
        iconColor = '#7C3AED',
        title,
        subtitle,
        onPress,
        rightElement,
        showChevron = true,
    }: {
        icon: string;
        iconColor?: string;
        title: string;
        subtitle?: string;
        onPress?: () => void;
        rightElement?: React.ReactNode;
        showChevron?: boolean;
    }) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress && !rightElement}
            activeOpacity={0.7}
            className="flex-row items-center p-3 bg-[#1A2332] rounded-xl mb-2"
        >
            <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: iconColor + '20' }}
            >
                <Feather name={icon as any} size={20} color={iconColor} />
            </View>
            <View className="flex-1 ml-3">
                <Text className="text-white text-base font-medium">{title}</Text>
                {subtitle && (
                    <Text className="text-gray-500 text-xs mt-0.5">{subtitle}</Text>
                )}
            </View>
            {rightElement}
            {showChevron && !rightElement && (
                <Feather name="chevron-right" size={20} color="#475569" />
            )}
        </TouchableOpacity>
    ),
);

// ==================== Main Component ====================

const SettingsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const { userInfo, logout } = useUserStore();

    /** Handle logout with custom dark modal instead of native Alert */
    const confirmLogout = async () => {
        setShowLogoutModal(false);
        await logout();
        showSuccess('See you next time! 👋', 'Logged Out');
        navigation.reset({
            index: 0,
            routes: [{ name: 'SignIn' }],
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View className="px-4 py-3">
                    <Text className="text-white text-2xl font-bold">Settings</Text>
                </View>

                {/* ── Profile Card ── */}
                <View className="px-4 mb-6">
                    <View className="bg-[#1A2332] rounded-2xl p-4">
                        <View className="flex-row items-center">
                            <View className="relative">
                                <Image
                                    source={{ uri: 'https://i.pravatar.cc/150?img=1' }}
                                    className="w-[72px] h-[72px] rounded-full border-[3px] border-[#7C3AED]"
                                />
                                <TouchableOpacity className="absolute bottom-0 right-0 w-[26px] h-[26px] rounded-full bg-[#7C3AED] items-center justify-center border-2 border-[#1A2332]">
                                    <Feather name="camera" size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="text-white text-xl font-bold">
                                    {userInfo?.fullName || 'User'}
                                </Text>
                                <Text className="text-gray-400 text-sm mt-0.5">
                                    {userInfo?.email || 'user@example.com'}
                                </Text>
                                <View className="flex-row items-center gap-1 mt-1">
                                    <MaterialIcons name="badge" size={14} color="#A78BFA" />
                                    <Text className="text-gray-500 text-xs">
                                        {userInfo?.studentId || 'SE171234'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            className="mt-4 bg-[#7C3AED] rounded-xl py-3 items-center"
                        >
                            <Text className="text-white text-sm font-semibold">Edit Profile</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Account ── */}
                <View className="px-4">
                    <Text className="text-gray-600 text-xs font-semibold mb-2 ml-1">ACCOUNT</Text>
                    <SettingItem
                        icon="lock"
                        iconColor="#06B6D4"
                        title="Change Password"
                        subtitle="Update your password"
                        onPress={() => { }}
                    />
                    <SettingItem
                        icon="link"
                        iconColor="#22C55E"
                        title="Linked Accounts"
                        subtitle="GitHub, Jira integration"
                        onPress={() => navigation.navigate('LinkedAccounts')}
                    />
                </View>

                {/* ── Preferences ── */}
                <View className="px-4 mt-6">
                    <Text className="text-gray-600 text-xs font-semibold mb-2 ml-1">
                        PREFERENCES
                    </Text>
                    <SettingItem
                        icon="bell"
                        iconColor="#EAB308"
                        title="Notifications"
                        subtitle={notificationsEnabled ? 'Enabled' : 'Disabled'}
                        showChevron={false}
                        rightElement={
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={setNotificationsEnabled}
                                trackColor={{ false: '#243447', true: '#7C3AED60' }}
                                thumbColor={notificationsEnabled ? '#7C3AED' : '#475569'}
                            />
                        }
                    />
                </View>

                {/* ── Support ── */}
                <View className="px-4 mt-6">
                    <Text className="text-gray-600 text-xs font-semibold mb-2 ml-1">SUPPORT</Text>
                    <SettingItem
                        icon="help-circle"
                        iconColor="#94A3B8"
                        title="Help Center"
                        onPress={() => { }}
                    />
                    <SettingItem
                        icon="info"
                        iconColor="#94A3B8"
                        title="About JiHub"
                        subtitle="Version 1.0.0"
                        onPress={() => { }}
                    />
                </View>

                {/* ── Logout Button ── */}
                <View className="px-4 mt-8">
                    <TouchableOpacity
                        onPress={() => setShowLogoutModal(true)}
                        activeOpacity={0.8}
                        className="bg-red-500/10 rounded-xl p-3 flex-row items-center justify-center gap-2"
                    >
                        <Feather name="log-out" size={20} color="#EF4444" />
                        <Text className="text-red-400 text-base font-semibold">Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* ═══════════════════════════════════════════════════
                Custom Dark Logout Modal (replaces native Alert)
               ═══════════════════════════════════════════════════ */}
            <Modal
                visible={showLogoutModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLogoutModal(false)}
            >
                {/* Dim backdrop — tap to dismiss */}
                <Pressable
                    onPress={() => setShowLogoutModal(false)}
                    className="flex-1 bg-black/60 items-center justify-center px-8"
                >
                    {/* Modal card — stopPropagation so taps inside don't close */}
                    <Pressable
                        onPress={() => { }}
                        className="bg-[#1A2332] rounded-2xl w-full p-6"
                    >
                        {/* Icon */}
                        <View className="items-center mb-4">
                            <View className="w-16 h-16 rounded-full bg-red-500/15 items-center justify-center">
                                <Feather name="log-out" size={28} color="#EF4444" />
                            </View>
                        </View>

                        {/* Title + Subtitle */}
                        <Text className="text-white text-xl font-bold text-center mb-2">
                            Log out?
                        </Text>
                        <Text className="text-gray-400 text-sm text-center mb-6">
                            You'll need to sign in again to access your projects and team.
                        </Text>

                        {/* Buttons */}
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setShowLogoutModal(false)}
                                activeOpacity={0.8}
                                className="flex-1 bg-white/5 rounded-xl py-3.5 items-center"
                            >
                                <Text className="text-white font-semibold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmLogout}
                                activeOpacity={0.8}
                                className="flex-1 bg-red-500 rounded-xl py-3.5 items-center"
                            >
                                <Text className="text-white font-semibold">Log out</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

export default SettingsScreen;
