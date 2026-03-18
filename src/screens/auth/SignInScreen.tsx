import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useUserStore } from '../../utils/stores/userStore';
import { login } from '../../services/authService';
import { showError, showSuccess } from '../../utils/toast';
import { Eye, EyeOff } from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const SignInScreen = ({ navigation }: Props) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const saveUserToStore = useUserStore((state) => state.login);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    const handleSignIn = async () => {
        try {
            const data = await login({ email, password });
            await saveUserToStore(data);
            showSuccess(`Welcome back, ${data.user.fullName}`, 'Login Successful');
            navigation.navigate('MainTabs');
        } catch (error: any) {
            showError('Email or password is incorrect', 'Login Failed');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#101922]">
            <StatusBar barStyle="light-content" backgroundColor="#101922" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }} className="flex-1 px-6 pt-10">

                        {/* Logo & Title */}
                        <View className="items-center mb-10">
                            <View className="mb-6">
                                <Image source={require('../../../public/Jihub.jpg')} className="w-20 h-20 rounded-2xl" resizeMode="cover" />
                            </View>
                            <Text className="text-white text-3xl font-bold mb-2">Welcome Back</Text>
                            <Text className="text-gray-400 text-base text-center">Sign in to continue managing your projects</Text>
                        </View>

                        {/* Email Input */}
                        <View className="mb-4">
                            <Text className="text-white text-sm font-medium mb-2 ml-1">Email</Text>
                            <View className={`flex-row items-center bg-[#1A2332] rounded-xl px-4 h-14 border gap-3 ${emailFocused ? 'border-[#7C3AED]' : 'border-white/10'
                                }`}>
                                <Feather name="mail" size={20} color={emailFocused ? '#7C3AED' : '#64748B'} />
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    onFocus={() => setEmailFocused(true)}
                                    onBlur={() => setEmailFocused(false)}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#64748B"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    className="flex-1 text-white text-base"
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View className="mb-2">
                            <Text className="text-white text-sm font-medium mb-2 ml-1">Password</Text>
                            <View className={`flex-row items-center bg-[#1A2332] rounded-xl px-4 h-14 border gap-3 ${passwordFocused ? 'border-[#7C3AED]' : 'border-white/10'
                                }`}>
                                <Feather name="lock" size={20} color={passwordFocused ? '#7C3AED' : '#64748B'} />
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#64748B"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    className="flex-1 text-white text-base"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        <Eye size={20} color="#64748B" />
                                    ) : (
                                        <EyeOff size={20} color="#64748B" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Forgot Password */}
                        <TouchableOpacity className="self-end mb-2">
                            <Text className="text-[#7C3AED] text-sm font-medium">Forgot Password?</Text>
                        </TouchableOpacity>

                        {/* Sign In Button */}
                        <TouchableOpacity onPress={handleSignIn} activeOpacity={0.8} className="mt-3 bg-[#7C3AED] rounded-xl py-4 items-center">
                            <Text className="text-white text-base font-semibold">Sign In</Text>
                        </TouchableOpacity>

                        {/* Sign Up Link */}
                        <View className="flex-row justify-center mt-8 pb-6">
                            <Text className="text-gray-400 text-sm">Don't have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                                <Text className="text-[#7C3AED] text-sm font-semibold">Sign Up</Text>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignInScreen;