import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DashboardScreen from '@/screens/main/DashboardScreen';
import ClassesScreen from '@/screens/main/ClassesScreen';
import TasksScreen from '@/screens/main/TasksScreen';
import NewsfeedScreen from '@/screens/main/NewsfeedScreen';
import SettingsScreen from '@/screens/main/SettingsScreen';

// ==================== Types ====================

export type MainTabParamList = {
    Dashboard: undefined;
    Classes: undefined;
    Tasks: undefined;
    Newsfeed: undefined;
    Settings: undefined;
};

// ==================== Constants ====================

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Tab definitions — icon names from Feather icon set */
const TABS = [
    { key: 'Dashboard', icon: 'home', label: 'Home' },
    { key: 'Classes', icon: 'book-open', label: 'Classes' },
    { key: 'Tasks', icon: 'check-square', label: 'Tasks' },
    { key: 'Newsfeed', icon: 'message-square', label: 'Feed' },
    { key: 'Settings', icon: 'settings', label: 'Settings' },
];

// ==================== Tab Item ====================

/** Individual tab button with scale animation */
const TabItem = React.memo(
    ({ route, isFocused, onPress }: { route: any; isFocused: boolean; onPress: () => void }) => {
        const scale = React.useRef(new Animated.Value(1)).current;
        const tab = TABS.find((t) => t.key === route.name);

        React.useEffect(() => {
            Animated.spring(scale, {
                toValue: isFocused ? 1.05 : 1, // Reduced scale for less rendering strain
                friction: 7, // Increased friction for smoother, less bouncy stop
                tension: 50, // Added tension to control speed
                useNativeDriver: true,
            }).start();
        }, [isFocused, scale]);

        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                className="flex-1 items-center justify-center py-2"
            >
                <Animated.View style={{ transform: [{ scale }] }} className="items-center">
                    {/* Icon container — active = purple glow, inactive = transparent */}
                    <View
                        className="w-11 h-11 items-center justify-center mb-0.5 rounded-2xl"
                        style={
                            isFocused
                                ? { backgroundColor: 'rgba(124, 58, 237, 0.15)' }
                                : undefined
                        }
                    >
                        <Feather
                            name={tab?.icon as any}
                            size={20}
                            color={isFocused ? '#A78BFA' : '#475569'}
                        />
                    </View>
                    <Text
                        className={`text-[10px] font-semibold ${isFocused ? 'text-[#A78BFA]' : 'text-[#475569]'
                            }`}
                    >
                        {tab?.label}
                    </Text>
                </Animated.View>
            </TouchableOpacity>
        );
    },
);

// ==================== Custom Tab Bar ====================

/** Borderless tab bar with gradient-like fade from content */
const CustomTabBar = ({ state, navigation }: { state: any; navigation: any }) => {
    const insets = useSafeAreaInsets();

    return (
        <View
            className="absolute bottom-0 left-0 right-0 bg-[#131C27]"
            style={{ paddingBottom: insets.bottom || 8 }}
        >
            <View className="flex-row pt-2 pb-1">
                {state.routes.map((route: any, index: number) => {
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TabItem
                            key={route.key}
                            route={route}
                            isFocused={isFocused}
                            onPress={onPress}
                        />
                    );
                })}
            </View>
        </View>
    );
};

// ==================== Navigator ====================

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <CustomTabBar {...props} />}
            detachInactiveScreens={true}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Classes" component={ClassesScreen} />
            <Tab.Screen name="Tasks" component={TasksScreen} />
            <Tab.Screen name="Newsfeed" component={NewsfeedScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

export default MainTabNavigator;
