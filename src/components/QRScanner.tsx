import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/hooks/useInventory';
import { QrCode, X, Camera, Flashlight, Focus, RefreshCw } from 'lucide-react';
import { createQRCodeReader, decodeFromVideoFrame } from '@/lib/qr/decoder';

type Facing = 'environment' | 'user';

type QRScannerUIOptions = {
  showTorch?: boolean;
  showFocusSlider?: boolean;
  requireStableResult?: boolean;
};

type QRScannerDecodeOptions = {
  throttleMs?: number;
  timeoutMs?: number;
  facingMode?: Facing;
};

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  location_id?: string;
  value?: number;
  purchase_date?: string;
  warranty_expires?: string;
  image_url?: string;
  has_qr_code: boolean;
  qr_code_data?: string;
  is_lent: boolean;
  lent_to?: string;
  lent_date?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemFound?: (item: InventoryItem) => void;
  ui?: QRScannerUIOptions;
  decode?: QRScannerDecodeOptions;
}

/**
 * Internal state machine for lifecycle
 */
type ScannerPhase = 'idle' | 'starting' | 'scanning' | 'success' | 'error' | 'stopping';

const DEBUG = false; // enable to get verbose console.debug logs

export function QRScanner({
  open,
  onOpenChange,
  onItemFound,
  ui,
  decode,
}: QRScannerProps) {
  // Defaults
  const uiOpts: Required<QRScannerUIOptions> = {
    showTorch: ui?.showTorch ?? true,
    showFocusSlider: ui?.showFocusSlider ?? true,
    requireStableResult: ui?.requireStableResult ?? true,
  };
  const decodeOpts: Required<QRScannerDecodeOptions> = {
    throttleMs: decode?.throttleMs ?? 150,
    timeoutMs: decode?.timeoutMs ?? 0, // 0 = no hard timeout
    facingMode: decode?.facingMode ?? 'environment',
  };

  const { items } = useInventory();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<ReturnType<typeof createQRCodeReader> | null>(null);
  const phaseRef = useRef<ScannerPhase>('idle');
  const [phase, setPhase] = useState<ScannerPhase>('idle');

  // Capabilities and settings
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [focusSupported, setFocusSupported] = useState(false);
  const [focusAutoMode, setFocusAutoMode] = useState<'continuous' | 'auto' | 'manual'>('continuous');
  const [focusDistanceRange, setFocusDistanceRange] = useState<{ min: number; max: number; step?: number } | null>(null);
  const [focusDistance, setFocusDistance] = useState<number | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Decode loop handles
  const rVFCIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const lastDecodeAtRef = useRef(0);
  const lastResultRef = useRef<{ text: string; time: number } | null>(null);
  const stopRequestedRef = useRef(false);

  const log = useCallback((...args: any[]) => {
    if (DEBUG) console.debug('[QRScanner]', ...args);
  }, []);

  const setPhaseSafe = useCallback((p: ScannerPhase) => {
    phaseRef.current = p;
    setPhase(p);
    log('phase ->', p);
  }, [log]);

  const stopTracks = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const t of stream.getTracks()) {
        try { t.stop(); } catch {}
      }
      streamRef.current = null;
    }
  }, []);

  const cleanupLoop = useCallback(() => {
    stopRequestedRef.current = true;
    if (rVFCIdRef.current != null && videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
      try {
        (videoRef.current as any).cancelVideoFrameCallback(rVFCIdRef.current);
      } catch {}
      rVFCIdRef.current = null;
    }
    if (intervalIdRef.current != null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const disposeReader = useCallback(() => {
    try {
      readerRef.current?.dispose();
    } catch {}
    readerRef.current = null;
  }, []);

  const fullCleanup = useCallback(() => {
    cleanupLoop();
    stopTracks();
    disposeReader();
  }, [cleanupLoop, stopTracks, disposeReader]);

  // Build media constraints with graceful fallback
  const buildConstraints = useCallback((facing: Facing) => {
    // Start with preferred 1280x720, facing env/user
    return {
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      } as MediaTrackConstraints,
    } as MediaStreamConstraints;
  }, []);

  const relaxConstraints = useCallback((facing: Facing): MediaStreamConstraints => {
    // Relax to just facingMode preferred
    return {
      audio: false,
      video: {
        facingMode: facing,
      },
    };
  }, []);

  const detectCapabilities = useCallback((track: MediaStreamTrack) => {
    try {
      const caps = (track.getCapabilities?.() ?? {}) as any;
      const settings = (track.getSettings?.() ?? {}) as any;

      const torch = !!caps.torch;
      setTorchSupported(torch);
      setTorchOn(Boolean(settings.torch));

      // Focus capabilities
      const fmodes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
      const focusModeSupported = fmodes.length > 0;
      const supportsContinuous = fmodes.includes('continuous');
      const supportsAuto = fmodes.includes('auto');
      const supportsManual = fmodes.includes('manual');

      const focusRangeExists = typeof caps.focusDistance?.min === 'number' && typeof caps.focusDistance?.max === 'number';
      setFocusSupported(focusModeSupported || focusRangeExists);

      // Default to continuous if supported, else auto, else manual
      let startMode: 'continuous' | 'auto' | 'manual' = 'continuous';
      if (supportsContinuous) startMode = 'continuous';
      else if (supportsAuto) startMode = 'auto';
      else if (supportsManual) startMode = 'manual';
      setFocusAutoMode(startMode);

      if (focusRangeExists) {
        setFocusDistanceRange({
          min: caps.focusDistance.min,
          max: caps.focusDistance.max,
          step: caps.focusDistance.step,
        });
        if (typeof settings.focusDistance === 'number') {
          setFocusDistance(settings.focusDistance);
        } else {
          // Initialize to mid value
          const mid = (caps.focusDistance.min + caps.focusDistance.max) / 2;
          setFocusDistance(mid);
        }
      } else {
        setFocusDistanceRange(null);
        setFocusDistance(null);
      }
    } catch (e) {
      log('capabilities detection error', e);
      setTorchSupported(false);
      setFocusSupported(false);
      setFocusDistanceRange(null);
      setFocusDistance(null);
    }
  }, [log]);

  const applyTorch = useCallback(async (on: boolean) => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = (track.getCapabilities?.() ?? {}) as any;
      if (!caps.torch) return;

      await track.applyConstraints({ advanced: [{ torch: on }] as any });
      setTorchOn(on);
      log('torch set', on);
    } catch (e) {
      log('torch apply error', e);
    }
  }, [log]);

  const setAutofocus = useCallback(async (mode: 'continuous' | 'auto') => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = (track.getCapabilities?.() ?? {}) as any;
      const modes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
      if (!modes.includes(mode)) {
        // fallback if not supported
        log('requested AF mode not supported:', mode, 'supported:', modes);
        return;
      }
      await track.applyConstraints({ advanced: [{ focusMode: mode }] as any });
      setFocusAutoMode(mode);
      log('focus mode set', mode);
    } catch (e) {
      log('autofocus error', e);
    }
  }, [log]);

  const setManualFocus = useCallback(async (distance: number) => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = (track.getCapabilities?.() ?? {}) as any;
      const modes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
      if (!(modes.includes('manual') || typeof caps.focusDistance?.min === 'number')) {
        log('manual focus not supported');
        return;
      }
      // Switch to manual with selected distance
      await track.applyConstraints({
        advanced: [{ focusMode: 'manual', focusDistance: distance }] as any,
      });
      setFocusAutoMode('manual');
      setFocusDistance(distance);
      log('manual focus set', distance);
    } catch (e) {
      log('manual focus error', e);
    }
  }, [log]);

  const revertAutoFocus = useCallback(async () => {
    // Prefer continuous, else auto if available
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = (track.getCapabilities?.() ?? {}) as any;
      const modes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
      if (modes.includes('continuous')) {
        await setAutofocus('continuous');
      } else if (modes.includes('auto')) {
        await setAutofocus('auto');
      }
    } catch (e) {
      log('revert autofocus error', e);
    }
  }, [log, setAutofocus]);

  const startStream = useCallback(async () => {
    setPhaseSafe('starting');
    setErrorMessage(null);
    setStatusMessage('Requesting camera...');

    const isSecure = window.isSecureContext;
    if (!isSecure) {
      setPhaseSafe('error');
      setErrorMessage('Camera access requires a secure context (HTTPS or localhost).');
      return;
    }

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(buildConstraints(decodeOpts.facingMode));
      } catch (e: any) {
        // Overconstrained or other error: relax constraints
        if (e?.name === 'OverconstrainedError') {
          log('overconstrained, relaxing constraints');
          stream = await navigator.mediaDevices.getUserMedia(relaxConstraints(decodeOpts.facingMode));
        } else {
          throw e;
        }
      }

      streamRef.current = stream!;
      const videoEl = videoRef.current!;
      videoEl.srcObject = stream;

      const track = stream!.getVideoTracks()[0];
      detectCapabilities(track);

      // Default autofocus setup if available
      try {
        const caps = (track.getCapabilities?.() ?? {}) as any;
        const modes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
        if (modes.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any });
          setFocusAutoMode('continuous');
        } else if (modes.includes('auto')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'auto' }] as any });
          setFocusAutoMode('auto');
        }
      } catch {
        // ignore
      }

      // Start video
      await videoEl.play().catch(() => {});

      // Prepare reader
      readerRef.current = createQRCodeReader();

      // Transition to scanning
      setPhaseSafe('scanning');
      setStatusMessage('Point camera at QR code.');
      stopRequestedRef.current = false;

      // Kick off decode loop
      runDecodeLoop();
    } catch (err: any) {
      log('startStream error', err);
      // Permission or device errors
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please allow camera access and try again.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera device found.');
      } else {
        setErrorMessage('Failed to start the camera.');
      }
      setPhaseSafe('error');
      fullCleanup();
    }
  }, [buildConstraints, decodeOpts.facingMode, detectCapabilities, fullCleanup, log, relaxConstraints, setPhaseSafe]);

  const stopStream = useCallback(() => {
    setPhaseSafe('stopping');
    cleanupLoop();
    stopTracks();
    disposeReader();
    setPhaseSafe('idle');
  }, [cleanupLoop, disposeReader, setPhaseSafe, stopTracks]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setStatusMessage(null);
    fullCleanup();
    if (open) {
      startStream();
    }
  }, [fullCleanup, open, startStream]);

  const handleClose = useCallback(() => {
    // Ensure hardware off
    stopStream();
    onOpenChange(false);
  }, [onOpenChange, stopStream]);

  // Decode loop implementation with rVFC fallback
  const handleDecodedText = useCallback((text: string) => {
    // Stability check when enabled
    if (uiOpts.requireStableResult) {
      const now = performance.now();
      const last = lastResultRef.current;
      lastResultRef.current = { text, time: now };
      if (last && last.text === text && now - last.time <= 400) {
        return true; // stable within window
      }
      return false; // wait for confirmation
    }
    return true;
  }, [uiOpts.requireStableResult]);

  const attemptMatchAndHandle = useCallback((decoded: string) => {
    // Same logic as existing: find item with has_qr_code and qr_code_data === decoded
    const foundItem = items.find((item: any) => item.has_qr_code && item.qr_code_data === decoded);

    if (foundItem) {
      toast({
        title: 'Item Found!',
        description: `Found: ${foundItem.name}`,
      });
      try {
        onItemFound?.(foundItem);
      } catch {}
      setPhaseSafe('success');
      // Close and cleanup
      onOpenChange(false);
      fullCleanup();
    } else {
      toast({
        title: 'Item Not Found',
        description: 'No item found with this QR code',
        variant: 'destructive',
      });
      // Keep scanning
    }
  }, [fullCleanup, items, onItemFound, onOpenChange, setPhaseSafe, toast]);

  const decodeTick = useCallback(async (time: number) => {
    if (stopRequestedRef.current) return;
    const now = performance.now();
    if (now - lastDecodeAtRef.current < decodeOpts.throttleMs) return;
    lastDecodeAtRef.current = now;

    const reader = readerRef.current?.reader;
    const video = videoRef.current;
    if (!reader || !video) return;

    try {
      // Use canvas-based decoding to avoid restarting camera sessions
      const result = await decodeFromVideoFrame(reader, video, time);
      if (result) {
        log('decode result', result);
        const stable = handleDecodedText(result);
        if (stable) {
          attemptMatchAndHandle(result);
        }
      }
    } catch (e) {
      log('decode error', e);
    }
  }, [attemptMatchAndHandle, decodeOpts.throttleMs, handleDecodedText, log]);

  const runDecodeLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // requestVideoFrameCallback preferred
    const hasRVFC = 'requestVideoFrameCallback' in video && typeof (video as any).requestVideoFrameCallback === 'function';

    const shouldProcess = () => document.visibilityState !== 'hidden' && !stopRequestedRef.current && phaseRef.current === 'scanning'

    if (hasRVFC) {
      const loop = (now: number) => {
        if (shouldProcess()) decodeTick(now)
        if (shouldProcess()) {
          rVFCIdRef.current = (video as any).requestVideoFrameCallback(loop);
        }
      };
      rVFCIdRef.current = (video as any).requestVideoFrameCallback(loop);
    } else {
      // Fallback: interval
      intervalIdRef.current = window.setInterval(() => {
        if (shouldProcess()) decodeTick(performance.now());
      }, Math.max(100, decodeOpts.throttleMs));
    }

    // Optional timeout to avoid hanging
    if (decodeOpts.timeoutMs > 0) {
      window.setTimeout(() => {
        if (phaseRef.current === 'scanning') {
          setStatusMessage('Still scanning...');
        }
      }, decodeOpts.timeoutMs);
    }
  }, [decodeOpts.throttleMs, decodeOpts.timeoutMs, decodeTick]);

  // Suspend decoding when tab is hidden to save CPU/battery
  useEffect(() => {
    const onVis = () => {
      // When becoming visible, nudge the loop by calling runDecodeLoop again
      if (document.visibilityState === 'visible' && phaseRef.current === 'scanning') {
        runDecodeLoop()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [runDecodeLoop])

  // React to dialog open/close
  useEffect(() => {
    if (open) {
      startStream();
    } else {
      // Ensure turning off hardware when dialog is closed externally
      fullCleanup();
      setStatusMessage(null);
      setErrorMessage(null);
      setPhaseSafe('idle');
    }
    // Cleanup on unmount
    return () => {
      fullCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // UI controls handlers
  const onToggleTorch = useCallback(() => {
    applyTorch(!torchOn);
  }, [applyTorch, torchOn]);

  const onFocusSliderChange = useCallback((vals: number[]) => {
    const v = vals[0];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      setManualFocus(v);
    }
  }, [setManualFocus]);

  const onSetAutoFocus = useCallback(() => {
    revertAutoFocus();
  }, [revertAutoFocus]);

  // Render UI
  const showControlsRow = useMemo(() => {
    const torch = uiOpts.showTorch && torchSupported;
    const focus = uiOpts.showFocusSlider && focusSupported && focusDistanceRange;
    return torch || focus;
  }, [focusDistanceRange, focusSupported, torchSupported, uiOpts.showFocusSlider, uiOpts.showTorch]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video viewport with responsive aspect and safe area */}
          <div className="w-full aspect-[3/4] sm:aspect-square bg-foreground rounded-lg overflow-hidden relative safe-bottom">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            {/* Overlay guide */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 sm:inset-6 border-2 border-foreground/40 rounded-lg"/>
            </div>
          </div>

          {showControlsRow && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {uiOpts.showTorch && torchSupported && (
                  <Button type="button" variant="outline" size="sm" onClick={onToggleTorch}>
                    <Flashlight className="w-4 h-4 mr-2" />
                    {torchOn ? 'Torch On' : 'Torch Off'}
                  </Button>
                )}
                {focusSupported && (
                  <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                    <Focus className="w-4 h-4" />
                    {focusAutoMode === 'manual' ? 'Manual Focus' : focusAutoMode === 'continuous' ? 'AF: Continuous' : 'AF: Auto'}
                    {focusAutoMode !== 'continuous' && focusAutoMode !== 'auto' && (
                      <Button type="button" variant="ghost" size="sm" onClick={onSetAutoFocus}>
                        Auto
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {uiOpts.showFocusSlider && focusSupported && focusDistanceRange && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Focus</span>
                  <Slider
                    value={[typeof focusDistance === 'number' ? focusDistance : (focusDistanceRange.min + focusDistanceRange.max) / 2]}
                    min={focusDistanceRange.min}
                    max={focusDistanceRange.max}
                    step={focusDistanceRange.step ?? (focusDistanceRange.max - focusDistanceRange.min) / 100}
                    onValueChange={onFocusSliderChange}
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground min-h-5">
            {phase === 'error' ? (
              <span className="text-destructive">{errorMessage ?? 'Camera error'}</span>
            ) : (
              <span>{statusMessage ?? (phase === 'scanning' ? 'Scanning...' : 'Initializing...')}</span>
            )}
          </div>

          {phase === 'error' && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          <div className="min-h-2" />

          <div className="text-xs text-muted-foreground text-center">
            Position the QR code within the camera view. Ensure your browser has camera permissions enabled.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}