import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/test-compress")({

	component: TestCompress,
});

import { useState, useRef } from "react";

type Result = {
  originalSize: number;
  compressedSize: number;
  reduction: number;
  timeMs: number;
  blob: Blob;
};

type CompressOptions = {
  bitrate: number;
  resolution: "original" | "1080p" | "720p" | "480p";
  codec: "avc" | "hevc";
  frameRate: "original" | "30" | "24";
  audioBitrate: number;
};

const RESOLUTIONS: Record<string, { label: string; height: number | null }> = {
  original: { label: "Original", height: null },
  "1080p": { label: "1080p", height: 1080 },
  "720p": { label: "720p", height: 720 },
  "480p": { label: "480p", height: 480 },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function analyzeVideo(file: File) {
  const { Input, BlobSource, MP4, WEBM, MATROSKA, QTFF } = await import("mediabunny");
  const input = new Input({
    source: new BlobSource(file),
    formats: [MP4, WEBM, MATROSKA, QTFF],
  });
  const videoTrack = await input.getPrimaryVideoTrack();
  const audioTrack = await input.getPrimaryAudioTrack();
  const videoStats = videoTrack ? await videoTrack.computePacketStats() : null;
  const audioStats = audioTrack ? await audioTrack.computePacketStats() : null;
  const duration = await input.computeDuration();

  const info = {
    duration,
    width: videoTrack?.displayWidth ?? 0,
    height: videoTrack?.displayHeight ?? 0,
    videoBitrate: videoStats?.averageBitrate ?? 0,
    audioBitrate: audioStats?.averageBitrate ?? 0,
    totalBitrate: (videoStats?.averageBitrate ?? 0) + (audioStats?.averageBitrate ?? 0),
    fps: videoStats?.averagePacketRate ?? 0,
    videoCodec: videoTrack?.codec ?? "unknown",
    audioCodec: audioTrack?.codec ?? "unknown",
  };

  input[Symbol.dispose]();
  return info;
}

async function compressVideo(
  file: File,
  opts: CompressOptions,
  onProgress: (p: number) => void,
): Promise<Result> {
  const {
    Input, Output, Conversion, BlobSource,
    Mp4OutputFormat, BufferTarget, MP4, WEBM, MATROSKA, QTFF,
  } = await import("mediabunny");

  const start = performance.now();

  const input = new Input({
    source: new BlobSource(file),
    formats: [MP4, WEBM, MATROSKA, QTFF],
  });

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });

  const videoOptions: Record<string, unknown> = {
    codec: opts.codec,
    bitrate: opts.bitrate,
  };

  // Resolution
  const res = RESOLUTIONS[opts.resolution];
  if (res.height) {
    videoOptions.height = res.height;
    // width auto-calculated to preserve aspect ratio
  }

  // Frame rate
  if (opts.frameRate !== "original") {
    videoOptions.frameRate = Number(opts.frameRate);
  }

  const conversion = await Conversion.init({
    input, output,
    video: videoOptions,
    audio: { codec: "aac", bitrate: opts.audioBitrate },
  });

  conversion.onProgress = onProgress;
  await conversion.execute();

  const buffer = output.target.buffer!;
  const blob = new Blob([buffer], { type: "video/mp4" });
  const elapsed = performance.now() - start;

  input[Symbol.dispose]();

  return {
    originalSize: file.size,
    compressedSize: blob.size,
    reduction: Math.round((1 - blob.size / file.size) * 100),
    timeMs: elapsed,
    blob,
  };
}

type VideoInfo = Awaited<ReturnType<typeof analyzeVideo>>;

const btnStyle = (active: boolean) => ({
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700 as const,
  border: "2px solid #333",
  background: active ? "#111" : "#fff",
  color: active ? "#fff" : "#333",
  cursor: "pointer" as const,
});

function TestCompress() {
  const [file, setFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [targetBitrate, setTargetBitrate] = useState(2_000_000);
  const [resolution, setResolution] = useState<CompressOptions["resolution"]>("original");
  const [codec, setCodec] = useState<CompressOptions["codec"]>("avc");
  const [frameRate, setFrameRate] = useState<CompressOptions["frameRate"]>("original");
  const [audioBitrate, setAudioBitrate] = useState(128_000);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const bitrateKbps = Math.round(targetBitrate / 1000);

  // Available resolutions based on source
  const availableResolutions = videoInfo
    ? Object.entries(RESOLUTIONS).filter(
        ([key, val]) => key === "original" || (val.height && val.height < videoInfo.height),
      )
    : [["original", RESOLUTIONS.original]];

  const run = async () => {
    if (!file) return;

    setResult(null);
    setProgress(0);
    setError(null);
    setRunning(true);

    try {
      const r = await compressVideo(file, {
        bitrate: targetBitrate,
        resolution,
        codec,
        frameRate,
        audioBitrate,
      }, setProgress);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setRunning(false);
  };

  const download = (r: Result) => {
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compressed-${bitrateKbps}kbps.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui", padding: "0 20px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Video Compression Test</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        Mediabunny (WebCodecs/GPU) — client-side video compression.
      </p>

      {/* File input */}
      <div style={{ marginBottom: 20 }}>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setResult(null);
              setVideoInfo(null);
              setAnalyzing(true);
              try {
                const info = await analyzeVideo(f);
                setVideoInfo(info);
                const suggested = Math.round(info.videoBitrate * 0.5);
                setTargetBitrate(Math.max(100_000, Math.min(suggested, 10_000_000)));
              } catch (err) {
                console.error("Analysis failed:", err);
              }
              setAnalyzing(false);
            }
          }}
        />
        {file && (
          <span style={{ marginLeft: 12, fontWeight: 600 }}>
            {file.name} — {formatBytes(file.size)}
          </span>
        )}
      </div>

      {/* Video info */}
      {analyzing && <p style={{ marginBottom: 16, color: "#888" }}>Analyzing video...</p>}
      {videoInfo && (
        <div style={{ marginBottom: 20, padding: 16, background: "#f0f4ff", border: "2px solid #4a7cff", fontSize: 14 }}>
          <strong>Source video info:</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
            <span>{videoInfo.width}x{videoInfo.height} @ {videoInfo.fps.toFixed(1)} fps</span>
            <span>Duration: {videoInfo.duration.toFixed(1)}s</span>
            <span>Codec: {videoInfo.videoCodec} / {videoInfo.audioCodec}</span>
            <span><strong>Video bitrate: {(videoInfo.videoBitrate / 1_000_000).toFixed(2)} Mbps</strong></span>
            <span>Audio bitrate: {(videoInfo.audioBitrate / 1000).toFixed(0)} kbps</span>
            <span>Total: {(videoInfo.totalBitrate / 1_000_000).toFixed(2)} Mbps</span>
          </div>
        </div>
      )}

      {/* Options grid */}
      <div style={{ display: "grid", gap: 20, marginBottom: 24 }}>

        {/* Resolution */}
        <div>
          <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8 }}>Resolution</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableResolutions.map(([key, val]) => (
              <button
                key={key as string}
                type="button"
                onClick={() => setResolution(key as CompressOptions["resolution"])}
                style={btnStyle(resolution === key)}
              >
                {(val as { label: string }).label}
                {key === "original" && videoInfo ? ` (${videoInfo.width}x${videoInfo.height})` : ""}
              </button>
            ))}
          </div>
          {resolution !== "original" && videoInfo && (
            <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              Downscaling from {videoInfo.height}p — biggest compression lever
            </p>
          )}
        </div>

        {/* Codec */}
        <div>
          <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8 }}>Codec</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setCodec("avc")} style={btnStyle(codec === "avc")}>
              H.264 (universal)
            </button>
            <button type="button" onClick={() => setCodec("hevc")} style={btnStyle(codec === "hevc")}>
              H.265 (smaller, less compat)
            </button>
          </div>
          {codec === "hevc" && (
            <p style={{ fontSize: 12, color: "#f59e0b", marginTop: 4 }}>
              H.265 may not work on all browsers/devices. ~40% smaller at same quality.
            </p>
          )}
        </div>

        {/* Frame rate */}
        {videoInfo && videoInfo.fps > 30 && (
          <div>
            <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8 }}>Frame Rate</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setFrameRate("original")} style={btnStyle(frameRate === "original")}>
                Original ({videoInfo.fps.toFixed(0)} fps)
              </button>
              <button type="button" onClick={() => setFrameRate("30")} style={btnStyle(frameRate === "30")}>
                30 fps
              </button>
              <button type="button" onClick={() => setFrameRate("24")} style={btnStyle(frameRate === "24")}>
                24 fps (cinematic)
              </button>
            </div>
          </div>
        )}

        {/* Bitrate slider */}
        <div>
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            Video bitrate: {bitrateKbps} kbps ({(targetBitrate / 1_000_000).toFixed(1)} Mbps)
          </label>
          <input
            type="range"
            min={videoInfo ? Math.max(100_000, Math.round(videoInfo.videoBitrate * 0.05)) : 500_000}
            max={videoInfo ? Math.round(videoInfo.videoBitrate * 0.95) : 10_000_000}
            step={videoInfo && videoInfo.videoBitrate < 2_000_000 ? 10_000 : 100_000}
            value={targetBitrate}
            onChange={(e) => setTargetBitrate(Number(e.target.value))}
            style={{ width: "100%", marginTop: 8 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888" }}>
            <span>{videoInfo ? `${Math.round(videoInfo.videoBitrate * 0.05 / 1000)} kbps (5%)` : "500 kbps"}</span>
            <span>{videoInfo ? `${(videoInfo.videoBitrate * 0.95 / 1_000_000).toFixed(1)} Mbps (95%)` : "10 Mbps"}</span>
          </div>
          {videoInfo && targetBitrate < videoInfo.videoBitrate && (
            <p style={{ color: "#16a34a", fontSize: 13, marginTop: 4 }}>
              ~{Math.round((1 - targetBitrate / videoInfo.videoBitrate) * 100)}% video bitrate reduction
            </p>
          )}
        </div>

        {/* Audio bitrate */}
        <div>
          <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8 }}>Audio bitrate</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { value: 64_000, label: "64 kbps" },
              { value: 96_000, label: "96 kbps" },
              { value: 128_000, label: "128 kbps" },
              { value: 192_000, label: "192 kbps" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAudioBitrate(opt.value)}
                style={btnStyle(audioBitrate === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={run}
        disabled={!file || running}
        style={{
          padding: "12px 32px",
          fontSize: 16,
          fontWeight: 700,
          background: "#111",
          color: "#fff",
          border: "none",
          cursor: file && !running ? "pointer" : "not-allowed",
          opacity: file && !running ? 1 : 0.5,
          marginBottom: 24,
        }}
      >
        {running ? `Compressing... ${(progress * 100).toFixed(0)}%` : "Compress"}
      </button>

      {/* Error */}
      {error && <p style={{ color: "red", fontWeight: 600, marginBottom: 16 }}>{error}</p>}

      {/* Result */}
      {result && (
        <div style={{ border: "2px solid #333", padding: 20, background: "#f8f8f8" }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Result</h3>
          <table style={{ width: "100%", fontSize: 14 }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Original</td>
                <td>{formatBytes(result.originalSize)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Compressed</td>
                <td>{formatBytes(result.compressedSize)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Reduction</td>
                <td style={{ fontWeight: 700, color: result.reduction > 0 ? "green" : "red" }}>
                  {result.reduction}%
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Time</td>
                <td>{(result.timeMs / 1000).toFixed(1)}s</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Settings</td>
                <td style={{ fontSize: 12, color: "#666" }}>
                  {codec === "hevc" ? "H.265" : "H.264"} · {resolution} · {frameRate === "original" ? "original fps" : `${frameRate} fps`} · {audioBitrate / 1000}k audio
                </td>
              </tr>
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => download(result)}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              background: "#222",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
}
