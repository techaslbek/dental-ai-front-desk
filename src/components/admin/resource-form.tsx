"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FieldConfig } from "@/lib/admin/fields";
import { initialFormState, type FormState } from "@/lib/admin/form-state";
import type { ErrorKey } from "@/lib/i18n";
import { FieldError, FieldHint, FormMessage, inputClass, PrimaryButton } from "./form-parts";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldConfig[];
  errorMessages: Record<ErrorKey, string>;
  labels: { submit: string; saving: string; saved: string; cancel?: string };
  cancelHref?: string;
};

export function ResourceForm({ action, fields, errorMessages, labels, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.status === "error" && state.formError ? (
        <FormMessage tone="error">{errorMessages[state.formError]}</FormMessage>
      ) : null}
      {state.status === "success" ? <FormMessage tone="success">{labels.saved}</FormMessage> : null}

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            error={errors[field.name] ? errorMessages[errors[field.name]] : undefined}
            submitted={values}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
        <PrimaryButton pending={pending} pendingLabel={labels.saving}>
          {labels.submit}
        </PrimaryButton>
        {cancelHref && labels.cancel ? (
          <Link href={cancelHref} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            {labels.cancel}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  field,
  error,
  submitted,
}: {
  field: FieldConfig;
  error?: string;
  submitted?: Record<string, string>;
}) {
  const id = `field-${field.name}`;
  const describedBy = [error ? `${id}-error` : null, field.hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const span = field.width === "half" ? "" : "md:col-span-2";
  // After a failed save, show what the user typed rather than the stored value.
  const value = submitted ? (submitted[field.name] ?? "") : (field.defaultValue ?? "");

  if (field.type === "checkbox") {
    const checked = submitted ? submitted[field.name] === "on" : Boolean(field.defaultChecked);
    return (
      <div className={`${span} flex items-start gap-3`}>
        <input
          id={id}
          name={field.name}
          type="checkbox"
          defaultChecked={checked}
          disabled={field.disabled}
          aria-describedby={describedBy}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
        />
        <div>
          <label htmlFor={id} className="text-sm font-medium text-slate-800">
            {field.label}
          </label>
          <FieldHint id={`${id}-hint`}>{field.hint}</FieldHint>
          <FieldError id={`${id}-error`} message={error} />
        </div>
      </div>
    );
  }

  const common = {
    id,
    name: field.name,
    defaultValue: value,
    required: field.required,
    maxLength: field.maxLength,
    placeholder: field.placeholder,
    disabled: field.disabled,
    lang: field.lang,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: inputClass,
  };

  return (
    <div className={span}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {field.label}
        {field.required ? <span aria-hidden="true" className="text-red-600"> *</span> : null}
      </label>
      {field.type === "textarea" ? (
        <textarea {...common} rows={4} />
      ) : field.type === "select" ? (
        <select {...common}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === "number" ? "text" : field.type}
          inputMode={field.inputMode}
          autoComplete={field.type === "tel" ? "tel" : "off"}
        />
      )}
      <FieldHint id={`${id}-hint`}>{field.hint}</FieldHint>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
