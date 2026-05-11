"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    router.prefetch("/login");
  }, [router]);

  async function handleSignOut() {
    setLoading(true);
    await signOut({
      callbackUrl: "/login",
      redirect: false,
    });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full justify-center"
      loading={loading}
      onClick={handleSignOut}
    >
      Sign out
    </Button>
  );
}
