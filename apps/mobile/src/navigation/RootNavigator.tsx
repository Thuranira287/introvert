import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import AIAssistantScreen from '../screens/app/AIAssistantScreen';
import AchievementsScreen from '../screens/app/AchievementsScreen';
import AnonymousInboxScreen from '../screens/app/AnonymousInboxScreen';
import BlogDetailScreen from '../screens/app/BlogDetailScreen';
import BlogsScreen from '../screens/app/BlogsScreen';
import ChatScreen from '../screens/app/ChatScreen';
import CommunitiesScreen from '../screens/app/CommunitiesScreen';
import CommunityDetailScreen from '../screens/app/CommunityDetailScreen';
import EarningsScreen from '../screens/app/EarningsScreen';
import EditProfileScreen from '../screens/app/EditProfileScreen';
import EventDetailScreen from '../screens/app/EventDetailScreen';
import EventsScreen from '../screens/app/EventsScreen';
import ExploreScreen from '../screens/app/ExploreScreen';
import HomeScreen from '../screens/app/HomeScreen';
import MessagesScreen from '../screens/app/MessagesScreen';
import MyProgressScreen from '../screens/app/MyProgressScreen';
import NewCommunityScreen from '../screens/app/NewCommunityScreen';
import NewEventScreen from '../screens/app/NewEventScreen';
import PremiumScreen from '../screens/app/PremiumScreen';
import ProfileScreen from '../screens/app/ProfileScreen';
import SettingsScreen from '../screens/app/SettingsScreen';
import UserDetailScreen from '../screens/app/UserDetailScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import { useAuthStore } from '../store/authStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen name="HomeScreen" component={HomeScreen} options={{ title: 'Introvert Corner' }} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="BlogDetail" component={BlogDetailScreen} options={{ title: 'Blog Post' }} />
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} options={{ title: 'AI Assistant' }} />
    </Stack.Navigator>
  );
}

function ExploreStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen name="ExploreScreen" component={ExploreScreen} options={{ title: 'Discover' }} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Communities" component={CommunitiesScreen} options={{ title: 'Communities' }} />
      <Stack.Screen name="NewCommunity" component={NewCommunityScreen} options={{ title: 'Create Community' }} />
      <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} options={{ title: 'Community' }} />
      <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="NewEvent" component={NewEventScreen} options={{ title: 'Create Event' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
    </Stack.Navigator>
  );
}

function BlogsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen name="BlogsScreen" component={BlogsScreen} options={{ title: 'Blog Posts' }} />
      <Stack.Screen name="BlogDetail" component={BlogDetailScreen} options={{ title: 'Blog Post' }} />
    </Stack.Navigator>
  );
}

function MessagesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontSize: 18, fontWeight: '600' },
      }}
    >
      <Stack.Screen name="MessagesScreen" component={MessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }: any) => ({ title: route.params?.displayName ?? 'Chat' })}
      />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'Profile' }} />
    </Stack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontSize: 18, fontWeight: '600' },
      }}
    >
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="AnonymousInbox" component={AnonymousInboxScreen} options={{ title: 'Anonymous Messages' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: 'Achievements' }} />
      <Stack.Screen name="MyProgress" component={MyProgressScreen} options={{ title: 'My Progress' }} />
      <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Earnings' }} />
      <Stack.Screen name="Premium" component={PremiumScreen} options={{ title: 'Get Verified' }} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'home';

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'ExploreTab') {
            iconName = focused ? 'compass' : 'compass-outline';
          } else if (route.name === 'BlogsTab') {
            iconName = focused ? 'document' : 'document-outline';
          } else if (route.name === 'MessagesTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="ExploreTab" component={ExploreStackNavigator} options={{ title: 'Explore' }} />
      <Tab.Screen name="BlogsTab" component={BlogsStackNavigator} options={{ title: 'Blogs' }} />
      <Tab.Screen name="MessagesTab" component={MessagesStackNavigator} options={{ title: 'Messages' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isLoading, userToken } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return userToken ? <AppNavigator /> : <AuthNavigator />;
}
