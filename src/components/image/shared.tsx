import { memo, type ReactNode } from "react";
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

export const ImagePageHeader = memo(function ImagePageHeader({
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
      backHref="/"
      backLabel="Back to Image Tools"
      tabKey="image"
    />
  );
});

// ============ Image File Info (alias) ============
export const ImageFileInfo = FileInfo;
