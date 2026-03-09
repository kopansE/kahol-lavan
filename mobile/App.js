import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Linking from "expo-linking";
import { supabase } from "./src/config/supabase";
import { StreamChatProvider } from "./src/contexts/StreamChatContext";
import { ToastProvider } from "./src/contexts/ToastContext";
import LoginScreen from "./src/screens/LoginScreen";
import MainScreen from "./src/screens/MainScreen";
import ChatChannelListScreen from "./src/screens/ChatChannelListScreen";
import ChatThreadScreen from "./src/screens/ChatThreadScreen";
import WalletScreen from "./src/screens/WalletScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import ReportScreen from "./src/screens/ReportScreen";
import LoadingSpinner from "./src/components/LoadingSpinner";

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.warn("Session restore failed, signing out:", error.message);
          supabase.auth.signOut();
          setUser(null);
        } else {
          setUser(session?.user ?? null);
        }
      })
      .catch((err) => {
        console.warn("Unexpected session error:", err);
        supabase.auth.signOut();
        setUser(null);
      })
      .finally(() => setLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Deep link fallback: handle auth callback if the app is opened via URL
    const handleAuthDeepLink = async (url) => {
      if (!url || !url.includes("auth/callback")) return;

      const hashIndex = url.indexOf("#");
      const queryIndex = url.indexOf("?");

      if (hashIndex !== -1) {
        const params = new URLSearchParams(url.substring(hashIndex + 1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          return;
        }
      }

      if (queryIndex !== -1) {
        const endIndex = hashIndex !== -1 ? hashIndex : url.length;
        const params = new URLSearchParams(
          url.substring(queryIndex + 1, endIndex),
        );
        const code = params.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    };

    const linkingSub = Linking.addEventListener("url", ({ url }) =>
      handleAuthDeepLink(url),
    );
    Linking.getInitialURL().then(handleAuthDeepLink);

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaProvider>
    <ToastProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <NavigationContainer>
          {user ? (
            <StreamChatProvider user={user}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Main">
                  {(props) => (
                    <MainScreen
                      {...props}
                      user={user}
                      onSignOut={handleSignOut}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen
                  name="ChatChannelList"
                  component={ChatChannelListScreen}
                />
                <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
                <Stack.Screen name="Wallet" component={WalletScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Reports" component={ReportsScreen} />
                <Stack.Screen name="Report" component={ReportScreen} />
              </Stack.Navigator>
            </StreamChatProvider>
          ) : (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Login" component={LoginScreen} />
            </Stack.Navigator>
          )}
        </NavigationContainer>
      </SafeAreaView>
    </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
