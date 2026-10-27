"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/admin/form-state";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  confirmMessage: string;
  errorMessage: string;
  itemName: string;
};

export function DeleteButton({ action, label, confirmMessage, errorMessage, itemName }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`${confirmMessage}\n\n${itemName}`)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        disabled={pending}
        aria-label={`${label}: ${itemName}`}
        className="rounded-md px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-60"
      >
        {label}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="ml-2 text-xs text-red-700">
          {errorMessage}
        </span>
      ) : null}
    </form>
  );
}
