"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import AuthForm from "@/components/auth/auth-form";
import { usePageName } from "@/hooks/use-page-name";
import { useSession } from "@/lib/auth-client";

function AuthContent() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  if (isPending || session) {
    return null;
  }

  return <AuthForm />;
}

export default function LoginPage() {
  usePageName("Login");

  return (
    <Suspense fallback={null}>
      <AuthContent />
    </Suspense>
  );
}
