"use client";

import { useCallback, useState } from "react";
import { AudioPageHeader } from "@/components/audio/shared";
import { DownloadIcon } from "@/components/icons/ui";
import { MusicTagIcon } from "@/components/icons/audio";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, ProgressBar } from "@/components/shared";
import { useFileProcessing, useProcessingResult } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  track: string;
}

export default function AudioMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata>({
    title: "",
    artist: "",
    album: "",
    year: "",
    genre: "",
    track: "",
  });

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult } = useProcessingResult();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const selectedFile = files[0];
      setFile(selectedFile);
      clearResult();

      // Extract filename as default title
      const baseName = getFileBaseName(selectedFile.name);
      setMetadata({
        title: baseName,
        artist: "",
        album: "",
        year: "",
        genre: "",
        track: "",
      });
    },
    [clearResult],
  );

  const handleSave = useCallback(async () => {
    if (!file || !startProcessing()) return;

    try {
      setProgress(20);

      // Dynamically import browser-id3-writer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ID3Writer = (await import("browser-id3-writer")).default as any;

      setProgress(40);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      setProgress(60);

      // Create ID3 writer
      const writer = new ID3Writer(arrayBuffer);

      // Add tags
      if (metadata.title) writer.setFrame("TIT2", metadata.title);
      if (metadata.artist) writer.setFrame("TPE1", [metadata.artist]);
      if (metadata.album) writer.setFrame("TALB", metadata.album);
      if (metadata.year) writer.setFrame("TYER", parseInt(metadata.year, 10) || 0);
      if (metadata.genre) writer.setFrame("TCON", [metadata.genre]);
      if (metadata.track) writer.setFrame("TRCK", metadata.track);

      writer.addTag();

      setProgress(80);

      // Get the result
      const taggedArrayBuffer = writer.arrayBuffer;
      const blob = new Blob([taggedArrayBuffer], { type: "audio/mpeg" });

      setResult(blob, `${getFileBaseName(file.name)}_tagged.mp3`);
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update audio metadata"));
    } finally {
      stopProcessing();
    }
  }, [file, metadata, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  }, [result]);

  const handleClear = useCallback(() => {
    setFile(null);
    setMetadata({ title: "", artist: "", album: "", year: "", genre: "", track: "" });
    clearResult();
  }, [clearResult]);

  const handleInputChange = (field: keyof AudioMetadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }));
  };

  const hasContent = metadata.title || metadata.artist || metadata.album;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<MusicTagIcon className="w-7 h-7" />}
        iconClass="tool-audio-metadata"
        title="Audio Metadata Editor"
        description="Edit ID3 tags for MP3 files"
      />

      {result ? (
        <div className="success-card animate-fade-up">
          <div className="success-stamp">
            <span className="success-stamp-text">Tagged</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-3xl font-display mb-2">Metadata Updated!</h2>
          <p className="text-muted-foreground mb-6">
            {metadata.title && <span className="block">{metadata.title}</span>}
            {metadata.artist && <span className="block text-sm">{metadata.artist}</span>}
          </p>
          <button type="button" onClick={handleDownload} className="btn-success w-full mb-4">
            <DownloadIcon className="w-5 h-5" />
            Download MP3
          </button>
          <button type="button" onClick={handleClear} className="btn-secondary w-full">
            Edit Another File
          </button>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".mp3"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your MP3 here"
            subtitle="to edit ID3 tags"
          />
          <InfoBox title="About ID3 Tags">
            ID3 tags store metadata like title, artist, and album in MP3 files. This information is displayed by
            music players.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border-2 border-foreground bg-muted/30">
            <div className="flex items-center gap-3">
              <MusicTagIcon className="w-8 h-8" />
              <div>
                <p className="font-bold truncate max-w-xs">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-bold text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="grid gap-4">
            <div>
              <label htmlFor="audio-title" className="input-label block mb-1">
                Title
              </label>
              <input
                id="audio-title"
                type="text"
                value={metadata.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="Song title"
              />
            </div>

            <div>
              <label htmlFor="audio-artist" className="input-label block mb-1">
                Artist
              </label>
              <input
                id="audio-artist"
                type="text"
                value={metadata.artist}
                onChange={(e) => handleInputChange("artist", e.target.value)}
                className="input-field w-full"
                placeholder="Artist name"
              />
            </div>

            <div>
              <label htmlFor="audio-album" className="input-label block mb-1">
                Album
              </label>
              <input
                id="audio-album"
                type="text"
                value={metadata.album}
                onChange={(e) => handleInputChange("album", e.target.value)}
                className="input-field w-full"
                placeholder="Album name"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="audio-year" className="input-label block mb-1">
                  Year
                </label>
                <input
                  id="audio-year"
                  type="text"
                  value={metadata.year}
                  onChange={(e) => handleInputChange("year", e.target.value)}
                  className="input-field w-full"
                  placeholder="2024"
                  maxLength={4}
                />
              </div>

              <div>
                <label htmlFor="audio-track" className="input-label block mb-1">
                  Track #
                </label>
                <input
                  id="audio-track"
                  type="text"
                  value={metadata.track}
                  onChange={(e) => handleInputChange("track", e.target.value)}
                  className="input-field w-full"
                  placeholder="1"
                />
              </div>

              <div>
                <label htmlFor="audio-genre" className="input-label block mb-1">
                  Genre
                </label>
                <input
                  id="audio-genre"
                  type="text"
                  value={metadata.genre}
                  onChange={(e) => handleInputChange("genre", e.target.value)}
                  className="input-field w-full"
                  placeholder="Pop"
                />
              </div>
            </div>
          </div>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Updating tags..." />}

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing || !hasContent}
            className="btn-primary w-full"
          >
            <MusicTagIcon className="w-5 h-5" />
            {isProcessing ? "Saving..." : "Save Metadata"}
          </button>
        </div>
      )}
    </div>
  );
}
