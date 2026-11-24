import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { useAuthStore } from '../store/authStore';

// Required once per app so the in-app browser correctly closes and returns
// control to the app after the user finishes the Google consent screen.
WebBrowser.maybeCompleteAuthSession();

/**
 * Wraps expo-auth-session's Google provider: prompts the native/web Google
 * consent flow, then exchanges the resulting ID token with our backend
 * (POST /auth/google/mobile) via authStore.signInWithGoogle, which issues
 * our own JWT pair — the Google token itself is never stored.
 *
 * Requires three separate OAuth client IDs from Google Cloud Console (one
 * each for iOS, Android, and Web — the Web one doubles as the Expo Go /
 * dev-client "proxy" client). Set them in apps/mobile/.env.local as
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
 * and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
 */
export function useGoogleSignIn() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') {
        setError('Google sign-in was cancelled or failed. Please try again.');
      }
      return;
    }

    const idToken = response.params?.id_token;
    if (!idToken) {
      setError('Google did not return the expected credentials.');
      return;
    }

    (async () => {
      setIsSigningIn(true);
      setError('');
      try {
        await signInWithGoogle(idToken);
      } catch (err: any) {
        setError(err.message || 'Google sign-in failed.');
      } finally {
        setIsSigningIn(false);
      }
    })();
  }, [response, signInWithGoogle]);

  return {
    promptGoogleSignIn: () => promptAsync(),
    isReady: !!request,
    isSigningIn,
    error,
  };
}
