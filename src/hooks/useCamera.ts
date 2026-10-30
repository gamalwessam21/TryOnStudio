import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'off' | 'requesting' | 'live' | 'error';

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  status: CameraStatus;
  errorMessage: string | null;
  mirrorView: boolean;
  setMirrorView: React.Dispatch<React.SetStateAction<boolean>>;
  startCamera: () => Promise<MediaStream | null>;
  stopCamera: () => void;
}

function mapMediaError(err: unknown): string {
  if (!window.isSecureContext) {
    return 'Camera access requires a secure connection (HTTPS or localhost). Please open the app over HTTPS.';
  }

  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission was denied. Please allow camera access in your browser address bar settings and try again.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was detected on this device. Connect a webcam and try again.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Your camera is currently in use by another application or tab. Close other camera apps and retry.';
      case 'OverconstrainedError':
        return 'Your camera did not match the requested video resolution. Please retry.';
      case 'SecurityError':
        return 'Camera access was blocked by browser security settings. Ensure you are using HTTPS.';
      default:
        return `Could not start camera (${err.name}). Please check permissions and try again.`;
    }
  }

  return 'Unable to access your camera. Please check browser permissions and try again.';
}

export function useCamera(onCameraStopped?: () => void): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onStoppedRef = useRef(onCameraStopped);
  onStoppedRef.current = onCameraStopped;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('off');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mirrorView, setMirrorView] = useState<boolean>(true);

  const cleanupTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  }, []);

  const stopCamera = useCallback(() => {
    cleanupTracks();
    setStatus('off');
    setErrorMessage(null);
    onStoppedRef.current?.();
  }, [cleanupTracks]);

  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current && status === 'live') {
      return streamRef.current;
    }

    if (!window.isSecureContext) {
      setStatus('error');
      setErrorMessage(
        'Camera access requires HTTPS in production. Please open Try On Studio over a secure HTTPS URL.'
      );
      return null;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setStatus('error');
      setErrorMessage(
        'Your browser does not support camera access (getUserMedia). Please use a modern browser such as Chrome, Edge, or Safari.'
      );
      return null;
    }

    cleanupTracks();
    setStatus('requesting');
    setErrorMessage(null);

    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });
      } catch (firstErr) {
        if (firstErr instanceof DOMException && firstErr.name === 'OverconstrainedError') {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          cleanupTracks();
          setStatus('off');
          onStoppedRef.current?.();
        };
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {
          // Autoplay muted video is permitted; ignore benign play() race
        });
      }

      setStatus('live');
      return mediaStream;
    } catch (err) {
      cleanupTracks();
      setStatus('error');
      setErrorMessage(mapMediaError(err));
      return null;
    }
  }, [cleanupTracks, status]);

  // Keep video element synced if mounted after stream starts
  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  // Ensure tracks are stopped on unmount
  useEffect(() => {
    return () => {
      cleanupTracks();
    };
  }, [cleanupTracks]);

  return {
    videoRef,
    stream,
    status,
    errorMessage,
    mirrorView,
    setMirrorView,
    startCamera,
    stopCamera,
  };
}

