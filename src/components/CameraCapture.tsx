import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, X, RotateCcw, Check, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
  description?: string;
}

export function CameraCapture({ 
  isOpen, 
  onClose, 
  onCapture, 
  title = "Capture Receipt", 
  description = "Position the receipt within the camera frame and tap capture" 
}: CameraCaptureProps) {
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  // Check for camera availability
  const checkCameraAvailability = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasCamera(videoDevices.length > 0);
      return videoDevices.length > 0;
    } catch (err) {
      console.error('Error checking camera availability:', err);
      setHasCamera(false);
      return false;
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const hasAvailableCamera = await checkCameraAvailability();
      if (!hasAvailableCamera) {
        throw new Error('No camera found on this device');
      }

      // Request camera access with optimal settings for document scanning
      const constraints = {
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          facingMode: isMobile ? 'environment' : 'user', // Use back camera on mobile
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let errorMessage = 'Unable to access camera';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported by this browser.';
      } else if (err.message.includes('No camera found')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setHasCamera(false);
    } finally {
      setIsLoading(false);
    }
  }, [isMobile, checkCameraAvailability]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and create preview URL
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setCapturedImage(url);
      }
    }, 'image/jpeg', 0.9);
  }, []);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
  }, [capturedImage]);

  // Confirm and save photo
  const confirmPhoto = useCallback(async () => {
    if (!canvasRef.current) return;

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `receipt-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        onCapture(file);
        handleClose();
      }
    }, 'image/jpeg', 0.9);
  }, [onCapture]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    onClose();
  }, [stopCamera, onClose, capturedImage]);

  // Start camera when dialog opens
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    }
  }, [isOpen, capturedImage, startCamera]);

  // Cleanup on unmount or dialog close
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [stopCamera, capturedImage]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        </DialogHeader>

        <div className="relative flex-1 min-h-0">
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {error}
                  <div className="mt-2 space-y-2">
                    {error.includes('permission') && (
                      <p className="text-xs">
                        To use the camera, please:
                        1. Allow camera access in your browser
                        2. Refresh the page and try again
                      </p>
                    )}
                    {error.includes('No camera found') && (
                      <p className="text-xs">
                        You can still upload receipt images using the file upload option.
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          ) : capturedImage ? (
            // Preview captured image
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured receipt"
                className="w-full h-auto max-h-[60vh] object-contain bg-black"
              />
              <div className="absolute top-2 right-2 space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={retakePhoto}
                  className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Retake
                </Button>
              </div>
            </div>
          ) : (
            // Camera view
            <div className="relative bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto max-h-[60vh] object-contain"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              
              {/* Camera overlay guide */}
              {!isLoading && !error && (
                <div className="absolute inset-4 border-2 border-white/30 border-dashed rounded-lg flex items-center justify-center pointer-events-none">
                  <div className="text-white text-center bg-black/50 px-3 py-2 rounded">
                    <p className="text-sm">Position receipt here</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 pt-2">
          {capturedImage ? (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={confirmPhoto} className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                Use Photo
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={capturePhoto} 
                disabled={isLoading || !!error}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />
    </Dialog>
  );
}