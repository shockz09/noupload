"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
// jsmediatags is dynamically imported to avoid react-native-fs SSR error
import { AudioFileInfo, AudioPageHeader, SuccessCard } from "@/components/audio/shared";
import { MusicTagIcon } from "@/components/icons/audio";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, ProgressBar } from "@/components/shared";
import { useFileProcessing, useProcessingResult } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { getFileBaseName } from "@/lib/utils";

interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  track: string;
}

interface PictureData {
  format: string;
  data: number[];
}

const EMPTY_METADATA: AudioMetadata = {
  title: "",
  artist: "",
  album: "",
  year: "",
  genre: "",
  track: "",
};

async function readTags(file: File): Promise<{ metadata: AudioMetadata; picture?: PictureData }> {
  const jsmediatags = (await import("jsmediatags")).default;
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        const t = tag.tags;
        resolve({
          metadata: {
            title: t.title || "",
            artist: t.artist || "",
            album: t.album || "",
            year: t.year || "",
            genre: t.genre || "",
            track: t.track || "",
          },
          picture: t.picture as PictureData | undefined,
        });
      },
      onError: () => {
        resolve({ metadata: { ...EMPTY_METADATA } });
      },
    });
  });
}

function buildAlbumArtUrl(picture: PictureData): string {
  const bytes = new Uint8Array(picture.data);
  const blob = new Blob([bytes], { type: picture.format });
  return URL.createObjectURL(blob);
}

export default function AudioMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [originalTags, setOriginalTags] = useState<AudioMetadata>(EMPTY_METADATA);
  const [metadata, setMetadata] = useState<AudioMetadata>(EMPTY_METADATA);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [hasExistingTags, setHasExistingTags] = useState(false);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } =
    useFileProcessing();
  const { result, setResult, clearResult } = useProcessingResult();

  useEffect(() => {
    return () => {
      if (artUrl) URL.revokeObjectURL(artUrl);
    };
  }, [artUrl]);

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const selectedFile = files[0];
      setFile(selectedFile);
      clearResult();
      setIsReading(true);

      const { metadata: readMeta, picture: readPicture } = await readTags(selectedFile);

      const resolvedMeta: AudioMetadata = {
        ...readMeta,
        title: readMeta.title || getFileBaseName(selectedFile.name),
      };

      const tagFound = Object.values(readMeta).some((v) => v !== "");
      setHasExistingTags(tagFound);
      setOriginalTags(resolvedMeta);
      setMetadata(resolvedMeta);

      if (readPicture) {
        setArtUrl(buildAlbumArtUrl(readPicture));
      } else {
        setArtUrl(null);
      }

      setIsReading(false);
    },
    [clearResult],
  );

  const hasChanges = useMemo(() => {
    return (Object.keys(originalTags) as (keyof AudioMetadata)[]).some(
      (key) => metadata[key] !== originalTags[key],
    );
  }, [metadata, originalTags]);

  const hasContent = metadata.title || metadata.artist || metadata.album;

  const handleSave = useCallback(async () => {
    if (!file || !startProcessing()) return;

    try {
      setProgress(20);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ID3Writer = (await import("browser-id3-writer")).default as any;

      setProgress(40);
      const arrayBuffer = await file.arrayBuffer();
      setProgress(60);

      const writer = new ID3Writer(arrayBuffer);
      if (metadata.title) writer.setFrame("TIT2", metadata.title);
      if (metadata.artist) writer.setFrame("TPE1", [metadata.artist]);
      if (metadata.album) writer.setFrame("TALB", metadata.album);
      if (metadata.year) writer.setFrame("TYER", parseInt(metadata.year, 10) || 0);
      if (metadata.genre) writer.setFrame("TCON", [metadata.genre]);
      if (metadata.track) writer.setFrame("TRCK", metadata.track);
      writer.addTag();

      setProgress(80);
      const blob = new Blob([writer.arrayBuffer], { type: "audio/mpeg" });
      setResult(blob, `${getFileBaseName(file.name)}_tagged.mp3`);
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update audio metadata"));
    } finally {
      stopProcessing();
    }
  }, [file, metadata, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleStrip = useCallback(async () => {
    if (!file || !startProcessing()) return;

    try {
      setProgress(30);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ID3Writer = (await import("browser-id3-writer")).default as any;

      setProgress(50);
      const arrayBuffer = await file.arrayBuffer();
      setProgress(70);

      const writer = new ID3Writer(arrayBuffer);
      writer.addTag();

      setProgress(90);
      const blob = new Blob([writer.arrayBuffer], { type: "audio/mpeg" });
      setResult(blob, `${getFileBaseName(file.name)}_stripped.mp3`);
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to strip audio metadata"));
    } finally {
      stopProcessing();
    }
  }, [file, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!result) return;
      downloadBlob(result.blob, result.filename);
    },
    [result],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    setMetadata(EMPTY_METADATA);
    setOriginalTags(EMPTY_METADATA);
    setHasExistingTags(false);
    if (artUrl) URL.revokeObjectURL(artUrl);
    setArtUrl(null);
    clearResult();
  }, [artUrl, clearResult]);

  function handleInputChange(field: keyof AudioMetadata, value: string): void {
    setMetadata((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<MusicTagIcon className="w-7 h-7" />}
        iconClass="tool-audio-metadata"
        title="Audio Metadata"
        description="View, edit, or strip ID3 tags for MP3 files"
      />

      {result ? (
        <SuccessCard
          stampText={result.filename.includes("_stripped") ? "Stripped" : "Tagged"}
          title={result.filename.includes("_stripped") ? "Tags Stripped!" : "Metadata Updated!"}
          subtitle={
            result.filename.includes("_stripped")
              ? "All ID3 tags have been removed"
              : metadata.title
                ? `${metadata.title}${metadata.artist ? ` — ${metadata.artist}` : ""}`
                : undefined
          }
          downloadLabel="Download MP3"
          onDownload={handleDownload}
          onStartOver={handleClear}
          startOverLabel="Edit Another File"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".mp3"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your MP3 here"
            subtitle="to view and edit ID3 tags"
          />
          <InfoBox title="About ID3 Tags">
            ID3 tags store metadata like title, artist, and album in MP3 files. This tool reads
            existing tags and lets you edit or strip them.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <AudioFileInfo file={file} onClear={handleClear} />

          {isReading && <ProgressBar progress={50} label="Reading tags..." />}

          {/* Existing tags read-only display */}
          {!isReading && hasExistingTags && (
            <div className="border-2 border-foreground p-4 bg-muted/30 space-y-3">
              <div className="flex items-center gap-3">
                {artUrl && (
                  <img
                    src={artUrl}
                    alt="Album art"
                    className="w-14 h-14 object-cover border-2 border-foreground"
                  />
                )}
                <p className="text-sm font-bold">Current Tags</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(["title", "artist", "album", "year", "track", "genre"] as (keyof AudioMetadata)[])
                  .filter((key) => originalTags[key])
                  .map((key) => (
                    <div key={key}>
                      <span className="text-muted-foreground capitalize">{key}:</span>{" "}
                      <span>{originalTags[key]}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {!isReading && !hasExistingTags && (
            <InfoBox title="No existing tags">
              No ID3 tags found. Fill in the fields below to add metadata.
            </InfoBox>
          )}

          {/* Edit form */}
          {!isReading && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label htmlFor="audio-title" className="input-label block mb-1">Title</label>
                  <input id="audio-title" type="text" value={metadata.title} onChange={(e) => handleInputChange("title", e.target.value)} className="input-field w-full" placeholder="Song title" />
                </div>
                <div>
                  <label htmlFor="audio-artist" className="input-label block mb-1">Artist</label>
                  <input id="audio-artist" type="text" value={metadata.artist} onChange={(e) => handleInputChange("artist", e.target.value)} className="input-field w-full" placeholder="Artist name" />
                </div>
                <div>
                  <label htmlFor="audio-album" className="input-label block mb-1">Album</label>
                  <input id="audio-album" type="text" value={metadata.album} onChange={(e) => handleInputChange("album", e.target.value)} className="input-field w-full" placeholder="Album name" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="audio-year" className="input-label block mb-1">Year</label>
                    <input id="audio-year" type="text" value={metadata.year} onChange={(e) => handleInputChange("year", e.target.value)} className="input-field w-full" placeholder="2024" maxLength={4} />
                  </div>
                  <div>
                    <label htmlFor="audio-track" className="input-label block mb-1">Track #</label>
                    <input id="audio-track" type="text" value={metadata.track} onChange={(e) => handleInputChange("track", e.target.value)} className="input-field w-full" placeholder="1" />
                  </div>
                  <div>
                    <label htmlFor="audio-genre" className="input-label block mb-1">Genre</label>
                    <input id="audio-genre" type="text" value={metadata.genre} onChange={(e) => handleInputChange("genre", e.target.value)} className="input-field w-full" placeholder="Pop" />
                  </div>
                </div>
              </div>

              {error && <ErrorBox message={error} />}
              {isProcessing && <ProgressBar progress={progress} label="Processing..." />}

              <button
                type="button"
                onClick={handleSave}
                disabled={isProcessing || !hasContent}
                className="btn-primary w-full"
              >
                <MusicTagIcon className="w-5 h-5" />
                {isProcessing ? "Saving..." : "Save Metadata"}
              </button>

              {/* Danger zone — same pattern as PDF metadata */}
              <div className="border-t-2 border-dashed border-foreground/20 pt-5 mt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Privacy</p>
                <button
                  type="button"
                  onClick={handleStrip}
                  disabled={isProcessing}
                  className="btn-secondary w-full"
                >
                  Strip All Current Tags
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  Removes title, artist, album, year, genre, track, and all other ID3 data.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
