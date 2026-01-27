import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from './src/config/supabase';
import { StreamChatProvider } from './src/contexts/StreamChatContext';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import ChatChannelListScreen from './src/screens/ChatChannelListScreen';
import ChatThreadScreen from './src/screens/ChatThreadScreen';
import WalletScreen from './src/screens/WalletScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoadingSpinner from './src/components/LoadingSpinner';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer>
        {user ? (
          <StreamChatProvider user={user}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main">
                {(props) => <MainScreen {...props} user={user} onSignOut={handleSignOut} />}
              </Stack.Screen>
              <Stack.Screen name="ChatChannelList" component={ChatChannelListScreen} />
              <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
              <Stack.Screen name="Wallet" component={WalletScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </Stack.Navigator>
          </StreamChatProvider>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
