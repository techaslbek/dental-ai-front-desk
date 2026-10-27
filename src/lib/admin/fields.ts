// Declarative form fields, built on the server with translated labels and
// rendered by the client <ResourceForm>. Must stay serialisable.
export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "textarea" | "tel" | "url" | "number" | "checkbox" | "select";
  defaultValue?: string;
  defaultChecked?: boolean;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: "numeric" | "tel" | "url" | "text";
  options?: { value: string; label: string }[];
  // "half" fields sit side by side on wide screens (e.g. Uzbek | Russian).
  width?: "half" | "full";
  lang?: "uz" | "ru";
};

export const str = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);
