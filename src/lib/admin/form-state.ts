import type { ErrorKey } from "@/lib/i18n";
import type { FieldErrors } from "@/lib/validation/clinic";

// Result of a form Server Action, consumed with useActionState.
// `values` echoes what was submitted so the form keeps the user's input
// after a failed save (React resets uncontrolled forms after an action).
export type FormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      fieldErrors: FieldErrors;
      formError?: ErrorKey;
      values: Record<string, string>;
    };

export const initialFormState: FormState = { status: "idle" };

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}
