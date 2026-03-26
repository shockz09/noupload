"use client";

import { useCallback, useMemo, useState } from "react";
import * as exifr from "exifr";
import { ImageIcon } from "@/components/icons/image";
import { MetadataIcon } from "@/components/icons/pdf";
import { LoaderIcon, ShieldIcon } from "@/components/icons/ui";
import { ErrorBox, ImageFileInfo, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { copyImageToClipboard, formatFileSize, getOutputFilename, stripMetadata } from "@/lib/image-utils";

// ============ Types ============

interface StripResultMeta {
  originalSize: number;
}

interface ParsedMetadata {
  camera?: CameraMetadata;
  capture?: CaptureMetadata;
  image?: ImageMetadata;
  gps?: GpsMetadata;
  other?: OtherMetadata;
}

interface CameraMetadata {
  Make?: string;
  Model?: string;
  LensModel?: string;
  Software?: string;
}

interface CaptureMetadata {
  DateTimeOriginal?: Date;
  ExposureTime?: number;
  FNumber?: number;
  ISO?: number;
  FocalLength?: number;
  Flash?: string;
  WhiteBalance?: string;
}

interface ImageMetadata {
  ImageWidth?: number;
  ImageHeight?: number;
  ColorSpace?: string;
  Orientation?: number;
}

interface GpsMetadata {
  latitude: number;
  longitude: number;
}

interface OtherMetadata {
  Copyright?: string;
  Artist?: string;
  Description?: string;
}

// ============ Formatting helpers ============

function formatExposureTime(value: number): string {
  if (value >= 1) return `${value}s`;
  const denominator = Math.round(1 / value);
  return `1/${denominator}s`;
}

function formatAperture(value: number): string {
  return `f/${value}`;
}

function formatFocalLength(value: number): string {
  return `${value}mm`;
}

function formatCoordinate(value: number, isLatitude: boolean): string {
  const direction = isLatitude
    ? value >= 0 ? "N" : "S"
    : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(6)}° ${direction}`;
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ============ Metadata extraction ============

async function extractMetadata(file: File): Promise<ParsedMetadata> {
  const [allData, gpsData] = await Promise.all([
    exifr.parse(file, true).catch(() => null),
    exifr.gps(file).catch(() => undefined),
  ]);

  if (!allData) return {};

  const metadata: ParsedMetadata = {};

  // Camera section
  const cameraFields: CameraMetadata = {};
  if (allData.Make) cameraFields.Make = String(allData.Make);
  if (allData.Model) cameraFields.Model = String(allData.Model);
  if (allData.LensModel) cameraFields.LensModel = String(allData.LensModel);
  if (allData.Software) cameraFields.Software = String(allData.Software);
  if (Object.keys(cameraFields).length > 0) metadata.camera = cameraFields;

  // Capture section
  const captureFields: CaptureMetadata = {};
  if (allData.DateTimeOriginal) captureFields.DateTimeOriginal = new Date(allData.DateTimeOriginal);
  if (allData.ExposureTime != null) captureFields.ExposureTime = Number(allData.ExposureTime);
  if (allData.FNumber != null) captureFields.FNumber = Number(allData.FNumber);
  if (allData.ISO != null) captureFields.ISO = Number(allData.ISO);
  if (allData.FocalLength != null) captureFields.FocalLength = Number(allData.FocalLength);
  if (allData.Flash != null) captureFields.Flash = String(allData.Flash);
  if (allData.WhiteBalance != null) captureFields.WhiteBalance = String(allData.WhiteBalance);
  if (Object.keys(captureFields).length > 0) metadata.capture = captureFields;

  // Image section
  const imageFields: ImageMetadata = {};
  if (allData.ImageWidth != null) imageFields.ImageWidth = Number(allData.ImageWidth);
  if (allData.ImageHeight != null) imageFields.ImageHeight = Number(allData.ImageHeight);
  if (allData.ColorSpace != null) imageFields.ColorSpace = String(allData.ColorSpace);
  if (allData.Orientation != null) imageFields.Orientation = Number(allData.Orientation);
  if (Object.keys(imageFields).length > 0) metadata.image = imageFields;

  // GPS section
  if (gpsData?.latitude != null && gpsData?.longitude != null) {
    metadata.gps = { latitude: gpsData.latitude, longitude: gpsData.longitude };
  }

  // Other section
  const otherFields: OtherMetadata = {};
  if (allData.Copyright) otherFields.Copyright = String(allData.Copyright);
  if (allData.Artist) otherFields.Artist = String(allData.Artist);
  const description = allData.ImageDescription || allData.Description;
  if (description) otherFields.Description = String(description);
  if (Object.keys(otherFields).length > 0) metadata.other = otherFields;

  return metadata;
}

function hasAnyMetadata(metadata: ParsedMetadata): boolean {
  return !!(metadata.camera || metadata.capture || metadata.image || metadata.gps || metadata.other);
}

// ============ Metadata section components ============

function MetadataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-foreground p-4 bg-card">
      <p className="input-label mb-3">{title}</p>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function CameraSection({ data }: { data: CameraMetadata }) {
  return (
    <MetadataSection title="Camera">
      {data.Make && <MetadataRow label="Make" value={data.Make} />}
      {data.Model && <MetadataRow label="Model" value={data.Model} />}
      {data.LensModel && <MetadataRow label="Lens" value={data.LensModel} />}
      {data.Software && <MetadataRow label="Software" value={data.Software} />}
    </MetadataSection>
  );
}

function CaptureSection({ data }: { data: CaptureMetadata }) {
  return (
    <MetadataSection title="Capture Settings">
      {data.DateTimeOriginal && (
        <MetadataRow label="Date" value={data.DateTimeOriginal.toLocaleString()} />
      )}
      {data.ExposureTime != null && (
        <MetadataRow label="Exposure" value={formatExposureTime(data.ExposureTime)} />
      )}
      {data.FNumber != null && (
        <MetadataRow label="Aperture" value={formatAperture(data.FNumber)} />
      )}
      {data.ISO != null && (
        <MetadataRow label="ISO" value={String(data.ISO)} />
      )}
      {data.FocalLength != null && (
        <MetadataRow label="Focal Length" value={formatFocalLength(data.FocalLength)} />
      )}
      {data.Flash && <MetadataRow label="Flash" value={data.Flash} />}
      {data.WhiteBalance && <MetadataRow label="White Balance" value={data.WhiteBalance} />}
    </MetadataSection>
  );
}

function ImageSection({ data }: { data: ImageMetadata }) {
  return (
    <MetadataSection title="Image">
      {data.ImageWidth != null && data.ImageHeight != null && (
        <MetadataRow label="Dimensions" value={`${data.ImageWidth} × ${data.ImageHeight}`} />
      )}
      {data.ColorSpace != null && <MetadataRow label="Color Space" value={String(data.ColorSpace)} />}
      {data.Orientation != null && <MetadataRow label="Orientation" value={String(data.Orientation)} />}
    </MetadataSection>
  );
}

function GpsSection({ data }: { data: GpsMetadata }) {
  return (
    <MetadataSection title="GPS Location">
      <MetadataRow label="Latitude" value={formatCoordinate(data.latitude, true)} />
      <MetadataRow label="Longitude" value={formatCoordinate(data.longitude, false)} />
      <div className="pt-1">
        <a
          href={googleMapsUrl(data.latitude, data.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
        >
          View on Google Maps &rarr;
        </a>
      </div>
    </MetadataSection>
  );
}

function OtherSection({ data }: { data: OtherMetadata }) {
  return (
    <MetadataSection title="Other">
      {data.Copyright && <MetadataRow label="Copyright" value={data.Copyright} />}
      {data.Artist && <MetadataRow label="Artist" value={data.Artist} />}
      {data.Description && <MetadataRow label="Description" value={data.Description} />}
    </MetadataSection>
  );
}

function MetadataDisplay({ metadata }: { metadata: ParsedMetadata }) {
  if (!hasAnyMetadata(metadata)) {
    return (
      <InfoBox title="No metadata found">
        This image does not contain any readable EXIF or metadata.
      </InfoBox>
    );
  }

  return (
    <div className="space-y-3">
      {metadata.camera && <CameraSection data={metadata.camera} />}
      {metadata.capture && <CaptureSection data={metadata.capture} />}
      {metadata.image && <ImageSection data={metadata.image} />}
      {metadata.gps && <GpsSection data={metadata.gps} />}
      {metadata.other && <OtherSection data={metadata.other} />}
    </div>
  );
}

// ============ Main page ============

export default function StripMetadataPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);

  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<StripResultMeta>();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;

      try {
        const stripped = await stripMetadata(fileToProcess);
        setResult(stripped, getOutputFilename(fileToProcess.name, undefined, "_clean"), {
          originalSize: fileToProcess.size,
        });
      } catch (err) {
        setError(getErrorMessage(err, "Failed to strip metadata"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setResult, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const selectedFile = files[0];
      setFile(selectedFile);
      clearResult();
      setPreview(selectedFile);
      setMetadata(null);

      if (isInstant) {
        processFile(selectedFile);
        return;
      }

      try {
        const parsed = await extractMetadata(selectedFile);
        setMetadata(parsed);
      } catch {
        setMetadata({});
      }
    },
    [isInstant, processFile, clearResult, setPreview],
  );

  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setMetadata(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    setMetadata(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const handleProcess = useCallback(() => {
    if (file) processFile(file);
  }, [file, processFile]);

  const showProcessingState = useMemo(() => isProcessing && !result, [isProcessing, result]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<MetadataIcon className="w-7 h-7" />}
        iconClass="tool-strip-metadata"
        title="Image Metadata"
        description="View EXIF data and GPS location, then strip it all for privacy"
      />

      {result ? (
        <SuccessCard
          stampText="Clean"
          title="Metadata Removed!"
          downloadLabel="Download Clean Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Clean Another"
        >
          <div className="bg-muted/50 border-2 border-foreground p-4 text-left">
            <p className="font-bold text-sm mb-2">Removed data includes:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Camera make and model</li>
              <li>• GPS coordinates and location</li>
              <li>• Date and time taken</li>
              <li>• Software used</li>
            </ul>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Original: {formatFileSize(result.metadata?.originalSize ?? 0)}</span>
            <span>Clean: {formatFileSize(result.blob.size)}</span>
          </div>
        </SuccessCard>
      ) : showProcessingState ? (
        <div className="border-2 border-foreground p-12 bg-card">
          <div className="flex flex-col items-center justify-center gap-4">
            <LoaderIcon className="w-8 h-8 animate-spin" />
            <div className="text-center">
              <p className="font-bold">Removing metadata...</p>
              <p className="text-sm text-muted-foreground">{file?.name}</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <ErrorBox message={error} />
          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Try Again
          </button>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.tiff,.tif"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your image here"
            subtitle="or click to browse · Ctrl+V to paste"
          />

          <InfoBox title={isInstant ? "Instant processing" : "Manual mode"} icon={<ShieldIcon className="w-5 h-5 mt-0.5" />}>
            {isInstant
              ? "Drop or paste an image and it will be cleaned automatically."
              : "Drop an image to view its metadata, then strip it if needed."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 mx-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          {metadata !== null && <MetadataDisplay metadata={metadata} />}

          <button type="button" onClick={handleProcess} disabled={isProcessing} className="btn-primary w-full">
            <ShieldIcon className="w-5 h-5" />
            Remove All Metadata
          </button>
        </div>
      )}
    </div>
  );
}
