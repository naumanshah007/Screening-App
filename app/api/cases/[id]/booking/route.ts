import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { saveCaseBooking } from "@/lib/cases/booking";
import { isFeatureEnabled } from "@/lib/features";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Cases v2 is disabled" },
    { status: 404 }
  );
}

type SaveBookingBody = {
  bookedForAt?: string;
  bookingNotes?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:book");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Session is missing user id" },
      { status: 401 }
    );
  }

  const body = (await req.json()) as SaveBookingBody;
  const { id } = await params;

  try {
    const updatedCase = await saveCaseBooking({
      caseId: id,
      actorUserId: userId,
      bookedForAt: body.bookedForAt,
      bookingNotes: body.bookingNotes,
    });

    return NextResponse.json(updatedCase);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save case booking";
    const status =
      message === "Referral case not found"
        ? 404
        : message === "Clinician decision is required before booking"
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
