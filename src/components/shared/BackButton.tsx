"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback } from "react";
import { ArrowLeftIcon } from "@/components/icons/ui";

interface BackButtonProps {
  fallbackHref: string;
  label: string;
}

export const BackButton = memo(function BackButton({ fallbackHref, label }: BackButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If there's browser history, go back to wherever the user came from
      if (window.history.length > 1) {
        e.preventDefault();
        router.back();
      }
      // Otherwise the <a> href fallback navigates normally
    },
    [router],
  );

  return (
    <a href={fallbackHref} onClick={handleClick} className="back-link">
      <ArrowLeftIcon className="w-4 h-4" />
      {label}
    </a>
  );
});
