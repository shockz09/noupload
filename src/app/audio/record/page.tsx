"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { downloadAudio, formatDuration, formatFileSize } from "@/lib/audio-utils";
import { ArrowLeftIcon, DownloadIcon } from "@/components/icons";

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export default function RecordAudioPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        setAudioBlob(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      setError("Failed to access microphone. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleDownload = () => {
    if (audioBlob) {
      const filename = `recording_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.wav`;
      downloadAudio(audioBlob, filename);
    }
  };

  const handleStartOver = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setError(null);
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-6">
        <Link href="/audio" className="back-link">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Audio Tools
        </Link>

        <div className="flex items-center gap-5">
          <div className="tool-icon tool-audio-record">
            <MicIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-4xl font-display">Record Audio</h1>
            <p className="text-muted-foreground mt-1">
              Record audio from your microphone
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {audioBlob && !isRecording ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Recorded</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">Recording Complete!</h2>
              <p className="text-muted-foreground">
                Duration: {formatDuration(recordingTime)} • {formatFileSize(audioBlob.size)}
              </p>
            </div>

            {audioUrl && (
              <audio controls src={audioUrl} className="w-full mb-6" />
            )}

            <button onClick={handleDownload} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download Recording
            </button>
          </div>

          <button onClick={handleStartOver} className="btn-secondary w-full">
            Record Again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Recording UI */}
          <div className="border-2 border-foreground p-8 text-center">
            {isRecording ? (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-destructive" />
                </div>
                <p className="text-4xl font-mono font-bold mb-2">
                  {formatDuration(recordingTime)}
                </p>
                <p className="text-muted-foreground">Recording...</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto mb-4 border-2 border-foreground rounded-full flex items-center justify-center">
                  <MicIcon className="w-10 h-10" />
                </div>
                <p className="text-muted-foreground">Click the button below to start recording</p>
              </>
            )}
          </div>

          {error && (
            <div className="error-box animate-shake">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {isRecording ? (
            <button onClick={stopRecording} className="btn-primary w-full bg-destructive hover:bg-destructive/90">
              <StopIcon className="w-5 h-5" />
              Stop Recording
            </button>
          ) : (
            <button onClick={startRecording} className="btn-primary w-full">
              <MicIcon className="w-5 h-5" />
              Start Recording
            </button>
          )}

          <div className="info-box">
            <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">Tip</p>
              <p className="text-muted-foreground">
                Make sure to allow microphone access when prompted. Recording is saved as WAV format.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
