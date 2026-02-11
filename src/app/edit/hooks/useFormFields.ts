// Form field type definition for PDF AcroForms
export interface FormField {
  id: string;
  name: string;
  type: "text" | "checkbox" | "radio" | "select" | "button";
  page: number;
  rect: { x: number; y: number; width: number; height: number };
  value: string;
  options?: string[];
  maxLength?: number;
  readOnly?: boolean;
  required?: boolean;
  multiline?: boolean;
}
