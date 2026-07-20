import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AuthStackParamList } from '../../navigation/types';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { DISCORD_BLUE, GOOGLE_BLUE, TWITCH_PURPLE } from '../../utils/brandColors';
import { logger } from '../../utils/logger';
import { BorderRadius, Colors, Spacing } from '../../utils/theme';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, 'Login'>>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { login, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login(username, password);
      await login(response.token, response.refreshToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      logger.error('Login failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSsoLogin = async (provider: 'discord' | 'google' | 'twitch') => {
    setSsoLoading(provider);
    setError(null);
    try {
      const result = await authService.loginWithSso(provider);
      if (result) {
        await login(result.token, result.refreshToken);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `${provider} login failed.`;
      setError(message);
      logger.error(
        `SSO ${provider} login failed`,
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      setSsoLoading(null);
    }
  };

  const handlePasskeyLogin = async () => {
    setSsoLoading('passkey');
    setError(null);
    try {
      const result = await authService.loginWithPasskey();
      if (result) {
        await login(result.token, result.refreshToken);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Passkey login failed.';
      setError(message);
      logger.error('Passkey login failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSsoLoading(null);
    }
  };

  const handleNavigateToRegister = () => {
    clearError();
    setError(null);
    navigation.navigate('Register');
  };

  const isAnyLoading = isLoading || ssoLoading !== null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Fringe Core</Text>
            <Text style={styles.subtitle}>Welcome Back</Text>
          </View>

          {/* SSO Login Buttons */}
          <View style={styles.ssoSection}>
            <TouchableOpacity
              style={[styles.ssoButton, { backgroundColor: DISCORD_BLUE }]}
              onPress={() => handleSsoLogin('discord')}
              disabled={isAnyLoading}
            >
              {ssoLoading === 'discord' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-discord" size={20} color="#ffffff" />
                  <Text style={styles.ssoButtonText}>Continue with Discord</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ssoButton, { backgroundColor: GOOGLE_BLUE }]}
              onPress={() => handleSsoLogin('google')}
              disabled={isAnyLoading}
            >
              {ssoLoading === 'google' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#ffffff" />
                  <Text style={styles.ssoButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ssoButton, { backgroundColor: TWITCH_PURPLE }]}
              onPress={() => handleSsoLogin('twitch')}
              disabled={isAnyLoading}
            >
              {ssoLoading === 'twitch' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-twitch" size={20} color="#ffffff" />
                  <Text style={styles.ssoButtonText}>Continue with Twitch</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ssoButton, styles.passkeyButton]}
              onPress={handlePasskeyLogin}
              disabled={isAnyLoading}
            >
              {ssoLoading === 'passkey' ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="finger-print" size={20} color={Colors.primary} />
                  <Text style={[styles.ssoButtonText, { color: Colors.primary }]}>
                    Sign in with Passkey
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Username/Password Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={Colors.textTertiary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isAnyLoading}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isAnyLoading}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.loginButton, isAnyLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isAnyLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.loginButtonText}>Log In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNavigateToRegister} disabled={isAnyLoading}>
              <Text style={styles.linkText}>Don&apos;t have an account? Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  ssoSection: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  ssoButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  passkeyButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.lg,
    fontSize: 14,
  },
  form: {
    gap: Spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    backgroundColor: Colors.surface,
    color: Colors.text,
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  loginButton: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
