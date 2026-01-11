"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { enforceSingleSession } from "@/actions/auth-security";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRedirectTo } from "@/hooks/use-redirect-to";
import { signIn } from "@/lib/auth-client";
import { getDeviceFingerprint } from "@/lib/utils/fingerprint";
import { usePinStore } from "@/stores/pin-store";
import PinSetupDialog from "./pin-setup-dialog";
import PinVerificationDialog from "./pin-verification-dialog";

export default function SignIn() {
  const router = useRouter();
  const redirectTo = useRedirectTo();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const { checkPinStatus, authCompleted } = usePinStore();

  // Redirect to original destination when auth flow is complete
  useEffect(() => {
    if (loading) return;

    if (authCompleted) {
      router.push(redirectTo);
    }
  }, [authCompleted, loading, router, redirectTo]);

  const handleSignIn = async () => {
    // Clear previous errors
    setUsernameError("");
    setPasswordError("");
    setGeneralError("");

    // Validate empty fields
    let hasError = false;
    if (!username.trim()) {
      setUsernameError("Please enter your Roll Number / Faculty ID");
      hasError = true;
    }
    if (!password.trim()) {
      setPasswordError("Please enter your password");
      hasError = true;
    }
    if (hasError) return;

    await signIn.username(
      {
        username,
        password,
      },
      {
        onRequest: () => {
          setLoading(true);
        },
        onResponse: () => {
          setLoading(false);
        },
        onSuccess: async () => {
          // Collect device fingerprint
          try {
            const fingerprint = await getDeviceFingerprint();
            // Check PIN status with fingerprint
            await checkPinStatus(fingerprint);
          } catch (error) {
            console.error("Failed to get fingerprint:", error);
            // Still check PIN status without fingerprint
            await checkPinStatus("");
          }

          // Enforce single session
          await enforceSingleSession();
        },
        onError: (ctx) => {
          setGeneralError(ctx.error.message || "Invalid credentials");
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleSignIn();
    }
  };

  return (
    <>
      <Card className="w-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-2xl">Sign In</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Enter your credentials below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {generalError && (
              <p className="text-sm text-destructive">{generalError}</p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="username">Roll Number / Faculty ID</Label>
              <Input
                id="username"
                type="text"
                placeholder="23951A052X"
                required
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError("");
                }}
                onKeyDown={handleKeyDown}
                value={username}
                className={usernameError ? "border-destructive" : ""}
              />
              {usernameError && (
                <p className="text-sm text-destructive">{usernameError}</p>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="#"
                  className="ml-auto inline-block text-sm underline"
                >
                  Forgot your password?
                </Link>
              </div>

              <Input
                id="password"
                type="password"
                placeholder="password"
                autoComplete="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                }}
                onKeyDown={handleKeyDown}
                className={passwordError ? "border-destructive" : ""}
              />
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              onClick={handleSignIn}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <p>Sign In</p>
              )}
            </Button>
          </div>
        </CardContent>
        <div className="w-auto h-px bg-border mx-4"></div>
        <CardFooter className="text-sm text-muted-foreground flex items-center justify-center">
          Built with 💖 at IARE!
        </CardFooter>
      </Card>

      {/* PIN Dialogs */}
      <PinSetupDialog />
      <PinVerificationDialog />
    </>
  );
}
