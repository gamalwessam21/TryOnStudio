import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createDecartClient,
  models,
  type ConnectionState,
  type DecartSDKError,
  type QueuePosition,
  type RealTimeClient,
  type SessionEnded,
} from '@decartai/sdk';
import { ApiError, fashionApi } from '../../services/fashionApi';
import type { FashionItemDetails, FashionVariant } from '../../types/api';
import { buildTryOnPrompt } from '../../utils/garmentHelpers';

export type TryOnStatus =
  | 'idle'
  | 'fetching_token'
  | 'connecting'
  | 'connected'
  | 'switching_garment'
  | 'error';

export interface TryOnErrorState {
  title: string;
  message: string;
  isBackendKeyMissing: boolean;
}

export interface UseDecartTryOnResult {
  tryOnVideoRef: React.RefObject<HTMLVideoElement | null>;
  tryOnStatus: TryOnStatus;
  connectionState: ConnectionState | null;
  queuePosition: QueuePosition | null;
  hasRemoteStream: boolean;
  tryOnError: TryOnErrorState | null;
  isConnected: boolean;
  isBusy: boolean;
  connectTryOn: (
    cameraStream: MediaStream,
    item: FashionItemDetails,
    variant: FashionVariant
  ) => Promise<boolean>;
  applyGarmentToSession: (
    item: FashionItemDetails,
    variant: FashionVariant
  ) => Promise<void>;
  disconnectTryOn: () => void;
  clearTryOnError: () => void;
}

async function fetchGarmentReferenceImage(
  imageUrl: string | null | undefined
): Promise<Blob | string | undefined> {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return undefined;

  try {
    const res = await fetch(trimmed, { mode: 'cors' });
    if (!res.ok) {
      return trimmed;
    }
    const blob = await res.blob();
    return blob.size > 0 ? blob : trimmed;
  } catch {
    return trimmed;
  }
}

function mapTryOnError(err: unknown): TryOnErrorState {
  if (err instanceof ApiError) {
    if (err.status === 502) {
      return {
        title: 'AI Virtual Try-On Not Configured on Backend',
        message:
          err.message ||
          'The server has not been configured with a Decart API key yet (HTTP 502). You can still browse all clothing items, inspect variants, and use Find My Size.',
        isBackendKeyMissing: true,
      };
    }
    if (err.status === 429) {
      return {
        title: 'Too Many Try-On Requests',
        message:
          'Temporary token rate limit reached. Please wait a moment and retry.',
        isBackendKeyMissing: false,
      };
    }
    return {
      title: 'Could Not Obtain Try-On Session Token',
      message:
        err.message ||
        'The backend token service returned an unexpected error. Please retry.',
      isBackendKeyMissing: false,
    };
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    typeof (err as DecartSDKError).message === 'string'
  ) {
    const sdkErr = err as DecartSDKError;
    return {
      title: 'Virtual Try-On Connection Error',
      message:
        sdkErr.message ||
        'Could not establish a live WebRTC stream with Decart. Please check your connection and retry.',
      isBackendKeyMissing: false,
    };
  }

  if (err instanceof Error) {
    return {
      title: 'Virtual Try-On Unavailable',
      message: err.message,
      isBackendKeyMissing: false,
    };
  }

  return {
    title: 'Virtual Try-On Unavailable',
    message:
      'Unable to start the live virtual try-on session right now. You can continue browsing garments and checking sizes.',
    isBackendKeyMissing: false,
  };
}

export function useDecartTryOn(): UseDecartTryOnResult {
  const tryOnVideoRef = useRef<HTMLVideoElement | null>(null);
  const realtimeClientRef = useRef<RealTimeClient | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const connectAttemptRef = useRef(0);
  const appliedKeyRef = useRef<string>('');
  const pendingGarmentRef = useRef<{
    item: FashionItemDetails;
    variant: FashionVariant;
  } | null>(null);
  const switchingRef = useRef(false);

  const [tryOnStatus, setTryOnStatus] = useState<TryOnStatus>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(
    null
  );
  const [queuePosition, setQueuePosition] = useState<QueuePosition | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState<boolean>(false);
  const [tryOnError, setTryOnError] = useState<TryOnErrorState | null>(null);

  const cleanupSession = useCallback(() => {
    connectAttemptRef.current += 1;
    pendingGarmentRef.current = null;
    switchingRef.current = false;
    appliedKeyRef.current = '';

    const client = realtimeClientRef.current;
    realtimeClientRef.current = null;
    if (client) {
      try {
        client.disconnect();
      } catch {
        // Ignore disconnect errors during teardown
      }
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (tryOnVideoRef.current) {
      tryOnVideoRef.current.srcObject = null;
    }

    setHasRemoteStream(false);
    setConnectionState(null);
    setQueuePosition(null);
  }, []);

  const disconnectTryOn = useCallback(() => {
    cleanupSession();
    setTryOnStatus('idle');
  }, [cleanupSession]);

  const clearTryOnError = useCallback(() => {
    setTryOnError(null);
    setTryOnStatus((prev) => (prev === 'error' ? 'idle' : prev));
  }, []);

  const connectTryOn = useCallback(
    async (
      cameraStream: MediaStream,
      item: FashionItemDetails,
      variant: FashionVariant
    ): Promise<boolean> => {
      cleanupSession();
      const attemptId = connectAttemptRef.current;

      setTryOnError(null);
      setTryOnStatus('fetching_token');

      try {
        // Pre-verify fresh short-lived token before initializing WebRTC session.
        // Never persisted to localStorage or sessionStorage.
        const initialToken = await fashionApi.getTryOnToken();
        if (attemptId !== connectAttemptRef.current) return false;

        if (!initialToken?.apiKey) {
          throw new Error(
            'Backend returned an empty try-on session token. Please try again.'
          );
        }

        setTryOnStatus('connecting');

        const promptText = buildTryOnPrompt(item, variant);
        const garmentImage = await fetchGarmentReferenceImage(variant.imageUrl);
        if (attemptId !== connectAttemptRef.current) return false;

        let usedInitialToken = false;
        const decart = createDecartClient({
          apiKeyProvider: async () => {
            if (!usedInitialToken) {
              usedInitialToken = true;
              return initialToken.apiKey;
            }
            const refreshed = await fashionApi.getTryOnToken();
            return refreshed.apiKey;
          },
        });

        const model = models.realtime('lucy-vton-latest');

        const rtClient = await decart.realtime.connect(cameraStream, {
          model,
          mirror: 'auto',
          initialState: {
            prompt: {
              text: promptText,
              enhance: false,
            },
            ...(garmentImage ? { image: garmentImage } : {}),
          },
          onRemoteStream: (editedStream: MediaStream) => {
            if (attemptId !== connectAttemptRef.current) {
              editedStream.getTracks().forEach((t) => t.stop());
              return;
            }
            remoteStreamRef.current = editedStream;
            setHasRemoteStream(true);
            if (tryOnVideoRef.current) {
              tryOnVideoRef.current.srcObject = editedStream;
              tryOnVideoRef.current.play().catch(() => undefined);
            }
          },
          onConnectionChange: (state: ConnectionState) => {
            if (attemptId !== connectAttemptRef.current) return;
            setConnectionState(state);
            if (state === 'disconnected') {
              setHasRemoteStream(false);
            }
          },
          onQueuePosition: (pos: QueuePosition) => {
            if (attemptId !== connectAttemptRef.current) return;
            setQueuePosition(pos);
          },
        });

        if (attemptId !== connectAttemptRef.current) {
          rtClient.disconnect();
          return false;
        }

        const handleSdkError = (sdkErr: DecartSDKError) => {
          if (attemptId !== connectAttemptRef.current) return;
          setTryOnError(mapTryOnError(sdkErr));
          cleanupSession();
          setTryOnStatus('error');
        };

        const handleSessionEnded = (ended: SessionEnded) => {
          if (attemptId !== connectAttemptRef.current) return;
          cleanupSession();
          setTryOnError({
            title: 'Try-On Session Ended',
            message: `The remote session closed (${ended.reason}). You can reconnect whenever ready.`,
            isBackendKeyMissing: false,
          });
          setTryOnStatus('error');
        };

        rtClient.on('error', handleSdkError);
        rtClient.on('sessionEnded', handleSessionEnded);

        realtimeClientRef.current = rtClient;
        appliedKeyRef.current = `${item.id}:${variant.id}`;
        setTryOnStatus('connected');
        return true;
      } catch (err) {
        if (attemptId !== connectAttemptRef.current) return false;
        cleanupSession();
        setTryOnError(mapTryOnError(err));
        setTryOnStatus('error');
        return false;
      }
    },
    [cleanupSession]
  );

  const applyGarmentToSession = useCallback(
    async (item: FashionItemDetails, variant: FashionVariant): Promise<void> => {
      const rtClient = realtimeClientRef.current;
      if (!rtClient || !rtClient.isConnected()) return;

      const nextKey = `${item.id}:${variant.id}`;
      if (appliedKeyRef.current === nextKey && !switchingRef.current) {
        return;
      }

      if (switchingRef.current) {
        pendingGarmentRef.current = { item, variant };
        return;
      }

      switchingRef.current = true;
      setTryOnStatus('switching_garment');

      try {
        let currentTarget: {
          item: FashionItemDetails;
          variant: FashionVariant;
        } | null = { item, variant };

        while (currentTarget && realtimeClientRef.current === rtClient) {
          const targetKey = `${currentTarget.item.id}:${currentTarget.variant.id}`;
          pendingGarmentRef.current = null;

          const promptText = buildTryOnPrompt(
            currentTarget.item,
            currentTarget.variant
          );
          const garmentImage = await fetchGarmentReferenceImage(
            currentTarget.variant.imageUrl
          );

          if (realtimeClientRef.current !== rtClient || !rtClient.isConnected()) {
            break;
          }

          await rtClient.set({
            prompt: promptText,
            image: garmentImage ?? null,
            enhance: false,
          });

          appliedKeyRef.current = targetKey;
          currentTarget = pendingGarmentRef.current;
        }
      } catch (err) {
        if (realtimeClientRef.current === rtClient) {
          setTryOnError(mapTryOnError(err));
        }
      } finally {
        switchingRef.current = false;
        if (realtimeClientRef.current === rtClient && rtClient.isConnected()) {
          setTryOnStatus('connected');
        }
      }
    },
    []
  );

  // Sync remote stream to output video element if mounted/re-rendered
  useEffect(() => {
    if (
      tryOnVideoRef.current &&
      remoteStreamRef.current &&
      tryOnVideoRef.current.srcObject !== remoteStreamRef.current
    ) {
      tryOnVideoRef.current.srcObject = remoteStreamRef.current;
      tryOnVideoRef.current.play().catch(() => undefined);
    }
  }, [hasRemoteStream]);

  // Always disconnect cleanly when unmounting
  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [cleanupSession]);

  const isConnected =
    tryOnStatus === 'connected' || tryOnStatus === 'switching_garment';
  const isBusy =
    tryOnStatus === 'fetching_token' ||
    tryOnStatus === 'connecting' ||
    tryOnStatus === 'switching_garment';

  return {
    tryOnVideoRef,
    tryOnStatus,
    connectionState,
    queuePosition,
    hasRemoteStream,
    tryOnError,
    isConnected,
    isBusy,
    connectTryOn,
    applyGarmentToSession,
    disconnectTryOn,
    clearTryOnError,
  };
}
