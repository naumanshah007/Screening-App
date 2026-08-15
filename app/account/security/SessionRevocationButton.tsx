"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SessionRevocationButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function revoke() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/account/sessions/revoke", { method: "POST" });
    if (!response.ok) {
      setError("Sessions could not be revoked. Try again or contact an administrator.");
      setLoading(false);
      return;
    }
    await signOut({ callbackUrl: "/login", redirect: false });
    window.location.assign("/login?reauth=1");
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" loading={loading} onClick={revoke}>
        Sign out all sessions
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
