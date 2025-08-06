import type { BrowserQRCodeReader } from '@zxing/browser';
import { BrowserQRCodeReader as ZXingBrowserQRCodeReader } from '@zxing/browser';
import { NotFoundException, ChecksumException, FormatException } from '@zxing/library';

/**
 * Creates a QR Code reader and a disposer.
 * Note: We intentionally do NOT expose or manage IScannerControls here anymore
 * to avoid accidental start/stop of device per frame which can blank the video.
 */
export function createQRCodeReader(): {
  reader: BrowserQRCodeReader;
  dispose: () => void;
} {
  const reader: BrowserQRCodeReader = new ZXingBrowserQRCodeReader();

  const dispose = () => {
    // no-op: reader has no resources unless decodeFromVideoDevice was started,
    // which we do not use in our looped scanning approach.
  };

  return { reader, dispose };
}

/**
 * Decode current video element frame by drawing to an offscreen canvas and using decodeFromImageUrl.
 * This avoids starting/stopping camera controls and prevents video flicker/black screen.
 */
export async function decodeFromVideoFrame(
  reader: BrowserQRCodeReader,
  video: HTMLVideoElement,
  _time: number
): Promise<string | null> {
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    const result = await reader.decodeFromImageUrl(dataUrl);
    return result?.getText() ?? null;
  } catch (err) {
    if (
      err instanceof NotFoundException ||
      err instanceof ChecksumException ||
      err instanceof FormatException
    ) {
      return null;
    }
    return null;
  }
}

/**
 * Attempts to decode from a canvas snapshot.
 * Kept for callers that already prepare a canvas elsewhere.
 */
export async function decodeFromCanvas(
  reader: BrowserQRCodeReader,
  canvasCtx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<string | null> {
  try {
    canvasCtx.getImageData(0, 0, width, height);
    const canvas = canvasCtx.canvas;
    const dataUrl = canvas.toDataURL('image/png');
    const result = await reader.decodeFromImageUrl(dataUrl);
    return result?.getText() ?? null;
  } catch (err) {
    if (
      err instanceof NotFoundException ||
      err instanceof ChecksumException ||
      err instanceof FormatException
    ) {
      return null;
    }
    return null;
  }
}