"use client";

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
}

interface Device {
  fingerprint: string;
  name: string;
  createdAt: Date;
}

import { Monitor, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { checkPinStatus, type PinStatusResult, setupPin } from "@/actions/pin";
import {
  getDevices,
  getSessions,
  removeDevice,
  revokeSession,
} from "@/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient, useSession } from "@/lib/auth-client";
import { getDeviceFingerprint } from "@/lib/utils/fingerprint";

export default function SecuritySettings() {
  useSession();
  const [fingerprint, setFingerprint] = useState<string>("");
  const [pinStatus, setPinStatus] = useState<PinStatusResult | null>(null);
  const [loadingPin, setLoadingPin] = useState(true);

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // PIN State
  const [pin, setPin] = useState("");
  const [pinStrategy, setPinStrategy] = useState("new_device");
  const [settingPin, setSettingPin] = useState(false);

  // Sessions & Devices State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const refreshSessionsAndDevices = async () => {
    setLoadingSessions(true);
    const [sess, devs] = await Promise.all([getSessions(), getDevices()]);
    setSessions(sess);
    setDevices(devs);
    setLoadingSessions(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: I don't want to pass refreshSessionsAndDevices to useEffect
  useEffect(() => {
    async function init() {
      const fp = await getDeviceFingerprint();
      setFingerprint(fp);
      const status = await checkPinStatus(fp);
      setPinStatus(status);
      setLoadingPin(false);

      refreshSessionsAndDevices();
    }
    init();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      await authClient.changePassword(
        {
          newPassword: newPassword,
          currentPassword: currentPassword, // better-auth usually requires user to be logged in, validation happens there.
          revokeOtherSessions: true,
        },
        {
          onSuccess: () => {
            toast.success("Password updated successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
          },
          onError: (ctx) => {
            toast.error(ctx.error.message || "Failed to update password");
          },
        },
      );
    } catch (_err) {
      toast.error("An error occurred");
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePinSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      toast.error("PIN must be 4 digits");
      return;
    }

    setSettingPin(true);
    try {
      const result = await setupPin(pin, pinStrategy);
      if (result.success) {
        toast.success("PIN settings updated");
        // Refresh status
        if (fingerprint) {
          const status = await checkPinStatus(fingerprint);
          setPinStatus(status);
        }
        setPin("");
      } else {
        toast.error(result.error);
      }
    } catch (_err) {
      toast.error("Failed to set PIN");
    } finally {
      setSettingPin(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const result = await revokeSession(sessionId);
      if (result.success) {
        toast.success("Session revoked");
        refreshSessionsAndDevices();
      } else {
        toast.error(result.error);
      }
    } catch (_err) {
      toast.error("Failed to revoke session");
    }
  };

  const handleRemoveDevice = async (fingerprint: string) => {
    try {
      const result = await removeDevice(fingerprint);
      if (result.success) {
        toast.success("Device removed from trusted list");
        refreshSessionsAndDevices();
      } else {
        toast.error(result.error);
      }
    } catch (_err) {
      toast.error("Failed to remove device");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Change your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PIN Settings</CardTitle>
            <CardDescription>
              Configure a PIN for additional security.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-full">
            {loadingPin ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="h-full flex flex-col gap-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {pinStatus?.pinEnabled
                        ? "PIN is currently enabled"
                        : "PIN is not set up"}
                    </p>
                  </div>
                  {pinStatus?.pinEnabled && (
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium dark:bg-green-900/30 dark:text-green-400">
                      Enabled
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handlePinSetup}
                  className="flex-1 flex flex-col gap-4"
                >
                  <div className="flex-1 grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <Label>PIN Strategy</Label>
                      <Select
                        value={pinStrategy}
                        onValueChange={(value) => setPinStrategy(value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a pin strategy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always">
                            Always Require PIN
                          </SelectItem>
                          <SelectItem value="new_device">
                            Require on New Device
                          </SelectItem>
                          <SelectItem value="random">
                            Randomly Require (10%)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Determine when you will be asked to enter your PIN.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>
                        {pinStatus?.pinEnabled ? "Change PIN" : "Set PIN"}
                      </Label>
                      <InputOTP
                        maxLength={4}
                        value={pin}
                        onChange={(value) => setPin(value)}
                      >
                        <InputOTPGroup className="w-full flex">
                          <InputOTPSlot className="flex-1" index={0} />
                          <InputOTPSlot className="flex-1" index={1} />
                          <InputOTPSlot className="flex-1" index={2} />
                          <InputOTPSlot className="flex-1" index={3} />
                        </InputOTPGroup>
                      </InputOTP>
                      <p className="text-xs text-muted-foreground">
                        Enter a 4-digit PIN.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={settingPin || pin.length !== 4}
                    >
                      {settingPin
                        ? "Saving..."
                        : pinStatus?.pinEnabled
                          ? "Update Settings"
                          : "Enable PIN"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Manage your active sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {loadingSessions ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {session.userAgent?.split(") ")[0]})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          IP: {session.ipAddress}
                        </p>
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            Current Session
                          </Badge>
                        )}
                      </div>
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeSession(session.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No active sessions found.
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Trusted Devices */}
        <Card>
          <CardHeader>
            <CardTitle>Trusted Devices</CardTitle>
            <CardDescription>
              Devices that skip PIN verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {loadingSessions ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {devices.map((device) => (
                    <div
                      key={device.fingerprint}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {device.name}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Added:{" "}
                          {new Date(device.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDevice(device.fingerprint)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {devices.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No trusted devices found.
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
