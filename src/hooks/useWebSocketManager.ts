import { useState, useEffect, useRef, useCallback } from 'react';

export type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface WebSocketEvent {
  type: string;
  payload?: any;
  message?: string;
  error?: string;
}

export function useWebSocketManager(token: string | null, onEventReceived?: (event: WebSocketEvent) => void) {
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const reconnectTimerRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);

  // Safely close connection
  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // Connect helper
  const connect = useCallback(() => {
    if (!token) return;

    disconnect(); // Ensure previous connections are wiped
    
    // Resolve secure and standard protocol paths
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    
    console.log(`Establishing real-time Tutor AI stream on: ${wsUrl}`);
    setStatus('reconnecting');

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('Handshake connected successfully. Sending JWT handshake payload...');
        socket.send(JSON.stringify({ type: 'AUTH', payload: { token } }));
        reconnectCountRef.current = 0; // reset
        setStatus('connected');

        // Start 25 seconds ping interval keep-alive
        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          
          if (parsed.type === 'PONG') {
            return; // silent ignore heartbeat acknowledgment
          }

          if (parsed.type === 'AUTH_SUCCESS') {
            console.log('Real-time sync state initialized.');
            return;
          }

          if (onEventReceived) {
            onEventReceived(parsed);
          }
        } catch (err) {
          console.error('Error decoding incoming WebSocket payload:', err);
        }
      };

      socket.onerror = (err) => {
        console.warn('Real-time socket connection error encountered:', err);
      };

      socket.onclose = () => {
        setStatus('reconnecting');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        
        // Execute Exponential Reconnect (3s + backoff scale up to 30s)
        const delay = Math.min(3000 + (reconnectCountRef.current * 2000), 30000);
        reconnectCountRef.current += 1;
        
        console.log(`Socket closed. Reconnecting in ${delay / 1000} seconds...`);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.error('WebSocket connection setup crash:', err);
      setStatus('disconnected');
    }
  }, [token, disconnect, onEventReceived]);

  useEffect(() => {
    if (token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  const sendEvent = useCallback((type: string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  }, []);

  return { status, sendEvent, reconnect: connect };
}
