import { Link } from "@tanstack/react-router";
import { memo, useCallback } from "react";
import { ArrowLeftIcon } from "@/components/icons/ui";

interface BackButtonProps {
  fallbackHref: string;
  label: string;
  tabKey?: string;
}

export const BackButton = memo(function BackButton({ fallbackHref, label, tabKey }: BackButtonProps) {
  const handleClick = useCallback(() => {
    if (tabKey) {
      sessionStorage.setItem("noupload-active-tab", tabKey);
    }
  }, [tabKey]);

  return (
    <Link to={fallbackHref} onClick={handleClick} className="back-link">
      <ArrowLeftIcon className="w-4 h-4" />
      {label}
    </Link>
  );
});
