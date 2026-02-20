"use client";

import { useCallback, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { AudioPageHeader, ErrorBox } from "@/components/audio/shared";
import { DownloadIcon, StopIcon } from "@/components/icons/ui";
import { MicIcon } from "@/components/icons/audio";
import { InfoBox } from "@/components/shared";
import { useObjectURL } from "@/hooks";
import { downloadAudio, formatDuration, formatFileSize } from "@/lib/audio-utils";

export default function RecordAudioPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use custom hooks
  const { url: audioUrl, setSource: setAudioSource, revoke: revokeAudio } = useObjectURL();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
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
        setAudioSource(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      setError("Failed to access microphone. Please allow microphone permissions.");
    }
  }, [setAudioSource]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const handleDownload = useCallback(() => {
    if (audioBlob) {
      const filename = `recording_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.wav`;
      downloadAudio(audioBlob, filename);
    }
  }, [audioBlob]);

  const handleStartOver = useCallback(() => {
    revokeAudio();
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
  }, [revokeAudio]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<MicIcon className="w-7 h-7" />}
        iconClass="tool-audio-record"
        title="Record Audio"
        description="Record audio from your microphone"
      />

      {audioBlob && !isRecording ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Recorded</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
              <div className="mb-6">
                <AudioPlayer src={audioUrl} />
              </div>
            )}

            <button type="button" onClick={handleDownload} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download Recording
            </button>
          </div>

          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
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
                <p className="text-4xl font-mono font-bold mb-2">{formatDuration(recordingTime)}</p>
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

          {error && <ErrorBox message={error} />}

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="btn-primary w-full bg-destructive hover:bg-destructive/90"
            >
              <StopIcon className="w-5 h-5" />
              Stop Recording
            </button>
          ) : (
            <button type="button" onClick={startRecording} className="btn-primary w-full">
              <MicIcon className="w-5 h-5" />
              Start Recording
            </button>
          )}

          <InfoBox title="Tip">
            Make sure to allow microphone access when prompted. Recording is saved as WAV format.
          </InfoBox>
        </div>
      )}
    </div>
  );
}
