"use client";

import { useActionState, useState } from "react";
import { initialFormState, type FormState } from "@/lib/admin/form-state";
import type { ErrorKey } from "@/lib/i18n";
import { DAYS, type Day, type OpeningHours } from "@/lib/validation/clinic";
import { FieldError, FormMessage, inputClass, PrimaryButton } from "./form-parts";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  hours: OpeningHours;
  isSet: boolean;
  errorMessages: Record<ErrorKey, string>;
  labels: {
    days: Record<Day, string>;
    closed: string;
    open: string;
    close: string;
    submit: string;
    saving: string;
    saved: string;
  };
};

export function HoursForm({ action, hours, isSet, errorMessages, labels }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const submitted = state.status === "error" ? state.values : undefined;

  // Closed days are tracked in state so their time inputs can be disabled.
  const [closed, setClosed] = useState<Record<Day, boolean>>(() =>
    Object.fromEntries(DAYS.map((d) => [d, isSet && hours[d].length === 0])) as Record<Day, boolean>,
  );

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.status === "error" && state.formError ? (
        <FormMessage tone="error">{errorMessages[state.formError]}</FormMessage>
      ) : null}
      {state.status === "success" ? <FormMessage tone="success">{labels.saved}</FormMessage> : null}

      <fieldset className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {DAYS.map((day) => {
          const interval = hours[day][0];
          const openValue = submitted?.[`${day}_open`] ?? interval?.open ?? "09:00";
          const closeValue = submitted?.[`${day}_close`] ?? interval?.close ?? "18:00";
          const openError = errors[`${day}_open`];
          const closeError = errors[`${day}_close`];
          return (
            <div key={day} className="grid grid-cols-2 items-start gap-3 px-4 py-3 sm:grid-cols-[10rem_8rem_1fr_1fr]">
              <span className="col-span-2 pt-2 text-sm font-medium text-slate-900 sm:col-span-1">{labels.days[day]}</span>
              <label className="col-span-2 flex items-center gap-2 pt-2 text-sm text-slate-700 sm:col-span-1">
                <input
                  type="checkbox"
                  name={`${day}_closed`}
                  checked={closed[day]}
                  onChange={(e) => setClosed((c) => ({ ...c, [day]: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                {labels.closed}
              </label>
              <div>
                <label htmlFor={`${day}_open`} className="sr-only">
                  {labels.days[day]}: {labels.open}
                </label>
                <input
                  id={`${day}_open`}
                  name={`${day}_open`}
                  type="time"
                  defaultValue={openValue}
                  disabled={closed[day]}
                  aria-invalid={openError ? true : undefined}
                  aria-describedby={openError ? `${day}_open-error` : undefined}
                  className={`${inputClass} mt-0`}
                />
                <FieldError id={`${day}_open-error`} message={openError ? errorMessages[openError] : undefined} />
              </div>
              <div>
                <label htmlFor={`${day}_close`} className="sr-only">
                  {labels.days[day]}: {labels.close}
                </label>
                <input
                  id={`${day}_close`}
                  name={`${day}_close`}
                  type="time"
                  defaultValue={closeValue}
                  disabled={closed[day]}
                  aria-invalid={closeError ? true : undefined}
                  aria-describedby={closeError ? `${day}_close-error` : undefined}
                  className={`${inputClass} mt-0`}
                />
                <FieldError id={`${day}_close-error`} message={closeError ? errorMessages[closeError] : undefined} />
              </div>
            </div>
          );
        })}
      </fieldset>

      <PrimaryButton pending={pending} pendingLabel={labels.saving}>
        {labels.submit}
      </PrimaryButton>
    </form>
  );
}
