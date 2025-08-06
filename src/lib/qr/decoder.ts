import type { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { BrowserQRCodeReader as ZXingBrowserQRCodeReader } from '@zxing/browser';
import { NotFoundException, ChecksumException, FormatException } from '@zxing/library';

/**
 * Creates a QR Code reader and a disposer to release any active scanner controls.
 * The reader itself is cheap; disposal stops any ongoing scan if one was started by callers.
 */
export function createQRCodeReader(): {
  reader: BrowserQRCodeReader;
  dispose: () => void;
} {
  const reader: BrowserQRCodeReader = new ZXingBrowserQRCodeReader();

  // Track last controls created by helper calls, for best-effort cleanup.
  let lastControls: IScannerControls | null = null;

  const dispose = () => {
    try {
      lastControls?.stop();
    } catch {
      // ignore cleanup errors
    } finally {
      lastControls = null;
    }
  };

  // Expose a tiny internal setter used by helpers below (kept internal to this module's pattern).
  Object.defineProperty(reader, '__qr_internal_set_controls', {
    value: (c: IScannerControls | null) => {
      try {
        lastControls?.stop();
      } catch {
        // ignore
      }
      lastControls = c;
    },
    enumerable: false,
    configurable: true,
    writable: true,
  });

  return { reader, dispose };
}

/**
 * Attempts to decode a single video frame.
 * Returns decoded string if found; otherwise null.
 * Swallows NotFound/Checksum/Format errors and unknown errors to keep callers simple.
 */
export async function decodeFromVideoFrame(
  reader: BrowserQRCodeReader,
  video: HTMLVideoElement,
  time: number
): Promise<string | null> {
  // Accept time to keep API stable; not used in this implementation.
  void time;

  let controls: IScannerControls | null = null;

  try {
    const resultText = await new Promise<string | null>(async (resolve) => {
      try {
        // Start scanning on the given video element; await controls object.
        controls = await reader.decodeFromVideoDevice(undefined, video, (result, err, ctrl) => {
          // Persist controls for external dispose if createQRCodeReader was used.
          (reader as unknown as { __qr_internal_set_controls?: (c: IScannerControls | null) => void })
            .__qr_internal_set_controls?.(ctrl ?? null);

          if (result) {
            resolve(result.getText());
            try {
              ctrl?.stop();
            } catch {
              // ignore
            }
            return;
          }
          if (err) {
            if (
              err instanceof NotFoundException ||
              err instanceof ChecksumException ||
              err instanceof FormatException
            ) {
              resolve(null);
            } else {
              resolve(null);
            }
            try {
              ctrl?.stop();
            } catch {
              // ignore
            }
          }
        });
      } catch {
        resolve(null);
      }
    });

    return resultText;
  } catch {
    return null;
  } finally {
    try {
      controls?.stop();
    } catch {
      // ignore
    }
  }
}

/**
 * Attempts to decode from a canvas snapshot.
 * Returns decoded string if found; otherwise null.
 *
 * BrowserQRCodeReader does not decode directly from ImageData, but can decode from an image URL.
 * Serialize the canvas to a data URL and use decodeFromImageUrl.
 */
export async function decodeFromCanvas(
  reader: BrowserQRCodeReader,
  canvasCtx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<string | null> {
  try {
    // Validate requested area exists (throws if out of bounds)
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