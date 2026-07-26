"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateProfile, type ProfileState } from "./actions";
import { Button, Field, ErrorNote, SuccessNote } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}

export function ProfileForm({
  displayName,
  phoneNumber,
  notifyWhatsapp,
}: {
  displayName: string;
  phoneNumber: string | null;
  notifyWhatsapp: boolean;
}) {
  const [state, formAction] = useFormState<ProfileState, FormData>(updateProfile, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Display name" name="display_name" defaultValue={displayName} required />
      <Field
        label="WhatsApp number"
        name="phone_number"
        type="tel"
        inputMode="tel"
        defaultValue={phoneNumber ?? ""}
        placeholder="+2782 123 4567"
        hint="Used for weekly result messages and reminders."
      />
      <label className="flex items-start gap-3 rounded-field bg-slope ring-1 ring-scree p-3">
        <input
          type="checkbox"
          name="notify_whatsapp"
          defaultChecked={notifyWhatsapp}
          className="mt-1 h-4 w-4 rounded border-scree text-ice"
        />
        <span className="text-sm text-snow/90">
          Send me WhatsApp results &amp; reminders
          <span className="block text-xs text-sage">You can turn this off anytime.</span>
        </span>
      </label>
      <ErrorNote>{state.error}</ErrorNote>
      <SuccessNote>{state.success}</SuccessNote>
      <Submit />
    </form>
  );
}
