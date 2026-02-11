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

// ============ PDF Page Header (wrapper) ============
interface PdfPageHeaderProps {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
}

export const PdfPageHeader = memo(function PdfPageHeader({ icon, iconClass, title, description }: PdfPageHeaderProps) {
  return (
    <PageHeader
      icon={icon}
      iconClass={iconClass}
      title={title}
      description={description}
      backHref="/"
      backLabel="Back to tools"
    />
  );
});

// ============ PDF File Info (alias) ============
export const PdfFileInfo = FileInfo;
