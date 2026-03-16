import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Platform } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "./src/config/supabase";
import { StreamChatProvider } from "./src/contexts/StreamChatContext";
import { ToastProvider, useToast } from "./src/contexts/ToastContext";
import MainScreen from "./src/screens/MainScreen";
import ChatChannelListScreen from "./src/screens/ChatChannelListScreen";
import ChatThreadScreen from "./src/screens/ChatThreadScreen";
import WalletScreen from "./src/screens/WalletScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import ReportScreen from "./src/screens/ReportScreen";
import LoadingSpinner from "./src/components/LoadingSpinner";

WebBrowser.maybeCompleteAuthSession();

const Stack = createStackNavigator();

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const handlePaymentDeepLink = (url) => {
      if (!url || !url.includes("payment-done")) return;
      WebBrowser.dismissBrowser();
    };

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

    const linkingSub = Linking.addEventListener("url", ({ url }) => {
      handleAuthDeepLink(url);
      handlePaymentDeepLink(url);
    });
    Linking.getInitialURL().then(handleAuthDeepLink);

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const redirectUrl = makeRedirectUri({
        scheme: "kahollavan",
        path: "auth/callback",
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
        );

        if (result.type === "success" && result.url) {
          const callbackUrl = result.url;
          const hashIndex = callbackUrl.indexOf("#");
          const queryIndex = callbackUrl.indexOf("?");

          if (hashIndex !== -1) {
            const params = new URLSearchParams(
              callbackUrl.substring(hashIndex + 1),
            );
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
              return;
            }
          }

          if (queryIndex !== -1) {
            const endIndex = hashIndex !== -1 ? hashIndex : callbackUrl.length;
            const params = new URLSearchParams(
              callbackUrl.substring(queryIndex + 1, endIndex),
            );
            const code = params.get("code");
            if (code) {
              await supabase.auth.exchangeCodeForSession(code);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error signing in:", error);
      showToast("ההתחברות עם Google נכשלה");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (error) throw error;
      }
    } catch (error) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        console.error("Error signing in with Apple:", error);
        showToast("ההתחברות עם Apple נכשלה");
      }
    }
  };

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
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <StreamChatProvider user={user}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main">
              {(props) => (
                <MainScreen
                  {...props}
                  user={user}
                  onSignOut={handleSignOut}
                  onSignIn={handleGoogleSignIn}
                  onAppleSignIn={handleAppleSignIn}
                />
              )}
            </Stack.Screen>
            {user && (
              <>
                <Stack.Screen
                  name="ChatChannelList"
                  component={ChatChannelListScreen}
                />
                <Stack.Screen
                  name="ChatThread"
                  component={ChatThreadScreen}
                />
                <Stack.Screen name="Wallet" component={WalletScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Reports" component={ReportsScreen} />
                <Stack.Screen name="Report" component={ReportScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </StreamChatProvider>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AppContent />
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
