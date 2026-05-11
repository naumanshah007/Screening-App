"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

function toDateTimeLocalValue(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function BookingUpdateForm({
  caseId,
  initialBookedForAt,
  initialBookingNotes,
  disabled,
  disabledMessage,
}: {
  caseId: string;
  initialBookedForAt?: string | Date | null;
  initialBookingNotes?: string | null;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const router = useRouter();
  const [bookedForAt, setBookedForAt] = useState(
    toDateTimeLocalValue(initialBookedForAt)
  );
  const [bookingNotes, setBookingNotes] = useState(initialBookingNotes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitBooking(nextBookedForAt: string, nextNotes: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookedForAt: nextBookedForAt,
          bookingNotes: nextNotes,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save booking");
      }

      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save booking"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitBooking(bookedForAt, bookingNotes);
  }

  async function handleClearBooking() {
    setBookedForAt("");
    await submitBooking("", bookingNotes);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        label="Booked appointment"
        type="datetime-local"
        value={bookedForAt}
        onChange={(event) => setBookedForAt(event.target.value)}
        disabled={disabled || loading}
        hint="Leave empty to keep the case unbooked."
      />

      <Textarea
        label="Booking notes"
        rows={4}
        value={bookingNotes}
        onChange={(event) => setBookingNotes(event.target.value)}
        placeholder="Coordinator notes, clinic allocation, or prep instructions"
        disabled={disabled || loading}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" loading={loading} disabled={disabled}>
          Save booking
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClearBooking}
          disabled={disabled || loading}
        >
          Clear booking
        </Button>
      </div>

      {disabled && (
        <div className="text-sm text-muted-foreground">
          {disabledMessage ?? "Save a clinician decision before booking this case."}
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
