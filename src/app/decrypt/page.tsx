"use client";

import { useCallback, useRef, useState } from "react";
import { PdfIcon, UnlockIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PasswordInput } from "@/components/pdf/PasswordInput";
import {
	ErrorBox,
	PdfFileInfo,
	PdfPageHeader,
	ProgressBar,
	SuccessCard,
} from "@/components/pdf/shared";
import { downloadBlob } from "@/lib/pdf-utils";
import { useQpdf } from "@/lib/qpdf";
import { formatFileSize } from "@/lib/utils";

interface DecryptResult {
	data: Uint8Array;
	filename: string;
}

export default function DecryptPage() {
	const [file, setFile] = useState<File | null>(null);
	const [password, setPassword] = useState("");
	const [result, setResult] = useState<DecryptResult | null>(null);
	const [localError, setLocalError] = useState<string | null>(null);
	const processingRef = useRef(false);

	const {
		decrypt,
		isProcessing,
		progress,
		error: qpdfError,
		clearError,
	} = useQpdf();

	const error = localError || qpdfError;

	const handleFileSelected = useCallback(
		(files: File[]) => {
			if (files.length > 0) {
				setFile(files[0]);
				setLocalError(null);
				setResult(null);
				clearError();
			}
		},
		[clearError],
	);

	const handleClear = useCallback(() => {
		setFile(null);
		setLocalError(null);
		setResult(null);
		setPassword("");
		clearError();
	}, [clearError]);

	const handleDecrypt = async () => {
		if (!file || processingRef.current) return;

		if (!password) {
			setLocalError("Please enter the password");
			return;
		}

		processingRef.current = true;
		setLocalError(null);

		try {
			const data = await decrypt(file, password);

			const baseName = file.name.replace(/\.pdf$/i, "");
			setResult({
				data,
				filename: `${baseName}_unlocked.pdf`,
			});
		} catch (err) {
			setLocalError(
				err instanceof Error ? err.message : "Failed to decrypt PDF",
			);
		} finally {
			processingRef.current = false;
		}
	};

	const handleDownload = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (result) {
			downloadBlob(result.data, result.filename);
		}
	};

	const handleStartOver = () => {
		setFile(null);
		setResult(null);
		setLocalError(null);
		setPassword("");
		clearError();
	};

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<UnlockIcon className="w-7 h-7" />}
				iconClass="tool-security"
				title="Decrypt PDF"
				description="Remove password protection from your PDF"
			/>

			{result ? (
				<SuccessCard
					stampText="Unlocked"
					title="PDF Decrypted!"
					downloadLabel="Download Unlocked PDF"
					onDownload={handleDownload}
					onStartOver={handleStartOver}
					startOverLabel="Decrypt Another"
				>
					<div className="text-center text-sm text-muted-foreground">
						Password protection has been removed
					</div>
				</SuccessCard>
			) : !file ? (
				<div className="space-y-6">
					<FileDropzone
						accept=".pdf"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your protected PDF here"
					/>

					<p className="text-sm text-muted-foreground">
						Got the password? Unlock it. Don&apos;t have it? Neither do we.
					</p>
				</div>
			) : (
				<div className="space-y-6">
					<PdfFileInfo
						file={file}
						fileSize={formatFileSize(file.size)}
						onClear={handleClear}
						icon={<PdfIcon className="w-5 h-5" />}
					/>

					<div className="border-2 border-foreground/20 rounded-lg p-6">
						<PasswordInput
							id="password"
							label="Password"
							value={password}
							onChange={setPassword}
							placeholder="Enter password"
							required
							disabled={isProcessing}
							autoFocus
						/>
					</div>

					{error && <ErrorBox message={error} />}
					{isProcessing && (
						<ProgressBar progress={progress} label="Decrypting..." />
					)}

					<button
						type="button"
						onClick={handleDecrypt}
						disabled={isProcessing || !password}
						className="btn-primary w-full"
					>
						{isProcessing ? (
							<>
								<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								Decrypting...
							</>
						) : (
							<>
								<UnlockIcon className="w-5 h-5" />
								Unlock PDF
							</>
						)}
					</button>
				</div>
			)}
		</div>
	);
}
