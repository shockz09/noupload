"use client";

import { useState } from "react";
import { GripIcon, PdfIcon, XIcon } from "@/components/icons";
import { cn, formatFileSize } from "@/lib/utils";

interface FileItem {
	file: File;
	id: string;
}

interface FileListProps {
	files: FileItem[];
	onRemove: (id: string) => void;
	onReorder?: (fromIndex: number, toIndex: number) => void;
	onClear: () => void;
}

export function FileList({
	files,
	onRemove,
	onReorder,
	onClear,
}: FileListProps) {
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [settledId, setSettledId] = useState<string | null>(null);

	if (files.length === 0) return null;

	const handleDragStart = (e: React.DragEvent, id: string, index: number) => {
		setDraggingId(id);
		e.dataTransfer.setData("text/plain", index.toString());
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragEnd = () => {
		setDraggingId(null);
		setDragOverId(null);
	};

	const handleDragOver = (e: React.DragEvent, id: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (id !== draggingId) {
			setDragOverId(id);
		}
	};

	const handleDragLeave = () => {
		setDragOverId(null);
	};

	const handleDrop = (
		e: React.DragEvent,
		toIndex: number,
		targetId: string,
	) => {
		e.preventDefault();
		const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
		if (onReorder && fromIndex !== toIndex) {
			onReorder(fromIndex, toIndex);
			// Trigger settle animation on the target position
			setSettledId(targetId);
			setTimeout(() => setSettledId(null), 300);
		}
		setDraggingId(null);
		setDragOverId(null);
	};

	return (
		<div className="space-y-4 animate-fade-in">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="file-number">{files.length}</div>
					<p className="text-sm font-bold text-foreground">
						{files.length === 1
							? "1 file selected"
							: `${files.length} files selected`}
					</p>
				</div>
				<button
					type="button"
					onClick={onClear}
					className="text-sm font-semibold text-muted-foreground hover:text-destructive transition-colors"
				>
					Clear all
				</button>
			</div>

			{/* File List */}
			<div className="space-y-2">
				{files.map((item, index) => (
					<div
						key={item.id}
						className={cn(
							"file-item group",
							draggingId === item.id && "drag-lifting",
							dragOverId === item.id &&
								draggingId !== item.id &&
								"drag-over-target",
							settledId === item.id && "drag-settled",
							draggingId && draggingId !== item.id && "drag-shifting",
						)}
						draggable={!!onReorder}
						onDragStart={(e) => handleDragStart(e, item.id, index)}
						onDragEnd={handleDragEnd}
						onDragOver={(e) => handleDragOver(e, item.id)}
						onDragLeave={handleDragLeave}
						onDrop={(e) => handleDrop(e, index, item.id)}
					>
						{/* Drag Handle */}
						{onReorder && (
							<div className="drag-handle">
								<GripIcon className="w-5 h-5" />
							</div>
						)}

						{/* Index */}
						<div className="file-number">{index + 1}</div>

						{/* File Icon */}
						<div className="pdf-icon-box">
							<PdfIcon className="w-5 h-5" />
						</div>

						{/* File Info */}
						<div className="flex-1 min-w-0">
							<p className="text-sm font-bold text-foreground truncate">
								{item.file.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{formatFileSize(item.file.size)}
							</p>
						</div>

						{/* Remove Button */}
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onRemove(item.id);
							}}
							className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-2 border-transparent hover:border-destructive transition-all opacity-0 group-hover:opacity-100"
						>
							<XIcon className="w-4 h-4" />
						</button>
					</div>
				))}
			</div>

			{/* Hint */}
			{onReorder && files.length > 1 && (
				<p className="text-xs text-muted-foreground text-center font-medium pt-2">
					Drag files to reorder them
				</p>
			)}
		</div>
	);
}
