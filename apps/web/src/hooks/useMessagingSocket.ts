'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenStorage } from '../lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

/**
 * Connects to the /messaging Socket.io namespace once a user is
 * authenticated, and tears the connection down on unmount. Returns the
 * live socket instance (null until connected) so callers can `.emit()`
 * and `.on()` directly.
 */
export function useMessagingSocket(enabled: boolean) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token = tokenStorage.getAccessToken();
    if (!token) return;

    const instance = io(`${SOCKET_URL}/messaging`, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [enabled]);

  return socket;
}
