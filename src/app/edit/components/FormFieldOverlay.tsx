"use client";

import { memo } from "react";
import type { FormField } from "../hooks/useFormFields";

interface FormFieldOverlayProps {
  fields: FormField[];
  scale: number;
  onFieldChange: (fieldId: string, value: string) => void;
}

export const FormFieldOverlay = memo(function FormFieldOverlay({
  fields,
  scale,
  onFieldChange,
}: FormFieldOverlayProps) {
  if (fields.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {fields.map((field) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: field.rect.x * scale,
          top: field.rect.y * scale,
          width: field.rect.width * scale,
          height: field.rect.height * scale,
          pointerEvents: "auto",
        };

        switch (field.type) {
          case "text":
            return (
              <input
                key={field.id}
                type="text"
                value={field.value}
                onChange={(e) => onFieldChange(field.id, e.target.value)}
                maxLength={field.maxLength}
                readOnly={field.readOnly}
                placeholder={field.name || ""}
                style={style}
                className="bg-blue-50/50 border border-blue-300 focus:border-blue-500 focus:bg-blue-50 outline-none px-1 text-sm transition-colors"
              />
            );

          case "checkbox":
            return (
              <div key={field.id} style={style} className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={field.value === "Yes" || field.value === "On" || field.value === "true"}
                  onChange={(e) => onFieldChange(field.id, e.target.checked ? "Yes" : "Off")}
                  disabled={field.readOnly}
                  className="w-full h-full max-w-5 max-h-5 cursor-pointer accent-blue-500"
                />
              </div>
            );

          case "radio":
            return (
              <div key={field.id} style={style} className="flex items-center justify-center">
                <input
                  type="radio"
                  name={field.name}
                  checked={field.value === "Yes" || field.value === "On"}
                  onChange={(e) => onFieldChange(field.id, e.target.checked ? "Yes" : "Off")}
                  disabled={field.readOnly}
                  className="w-full h-full max-w-4 max-h-4 cursor-pointer accent-blue-500"
                />
              </div>
            );

          case "select":
            return (
              <select
                key={field.id}
                value={field.value}
                onChange={(e) => onFieldChange(field.id, e.target.value)}
                disabled={field.readOnly}
                style={style}
                className="bg-blue-50/50 border border-blue-300 focus:border-blue-500 focus:bg-blue-50 outline-none text-sm cursor-pointer"
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            );

          case "button":
            // Buttons are typically just labels, not interactive
            return null;

          default:
            return null;
        }
      })}
    </div>
  );
});
