import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error('Error accessing camera:', err);
        setError(err.name === 'NotFoundError' ? 'No se encontró ninguna cámara.' : 'No se pudo acceder a la cámara. Por favor, verifica los permisos.');
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'evidencia.jpg', { type: 'image/jpeg' });
            onCapture(file);
            onClose();
          }
        }, 'image/jpeg');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Capturar Evidencia</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X size={24} />
          </button>
        </div>
        {error ? (
          <div className="text-red-500 text-center p-4">{error}</div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg mb-4" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex justify-center">
              <button
                onClick={captureImage}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                <Camera size={24} className="mr-2" />
                Capturar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
