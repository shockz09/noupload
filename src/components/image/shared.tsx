import type { ReactNode } from "react";
import { FileInfo, PageHeader } from "@/components/shared";

// Re-export common components
export {
	ComparisonDisplay,
	ErrorBox,
	ProcessButton,
	ProgressBar,
	SavingsBadge,
	SuccessCard,
} from "@/components/shared";

// ============ Image Page Header (wrapper) ============
interface ImagePageHeaderProps {
	icon: ReactNode;
	iconClass: string;
	title: string;
	description: string;
}

export function ImagePageHeader({
	icon,
	iconClass,
	title,
	description,
}: ImagePageHeaderProps) {
	return (
		<PageHeader
			icon={icon}
			iconClass={iconClass}
			title={title}
			description={description}
			backHref="/image"
			backLabel="Back to Image Tools"
		/>
	);
}

// ============ Image File Info (alias) ============
export const ImageFileInfo = FileInfo;
