"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfile, applyForCreator, updatePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarCropUpload } from "@/components/upload/avatar-crop-upload";
import { uploadViaApi } from "@/lib/upload-client";
import { formatDisplayName } from "@/lib/display-name";
import { toast } from "@/hooks/use-toast";

type User = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  locale: string;
  discordId: string | null;
  role: string;
  hasCreatorProfile: boolean;
};

export function SettingsForm({ locale, user }: { locale: string; user: User }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="glass">
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <UserAvatar src={user.avatarUrl} name={formatDisplayName(user)} className="h-16 w-16" />
            <div>
              <AvatarCropUpload
                label="Upload avatar"
                onCropped={async (file) => {
                  startTransition(async () => {
                    try {
                      await uploadViaApi({ file, purpose: "user-avatar" });
                      toast({ title: "Avatar updated" });
                      router.refresh();
                    } catch (err) {
                      toast({
                        title: "Error",
                        description: err instanceof Error ? err.message : "Upload failed",
                        variant: "destructive",
                      });
                    }
                  });
                }}
              />
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await updateProfile({
                  displayName: fd.get("displayName") as string,
                  bio: fd.get("bio") as string,
                  locale: fd.get("locale") as "en" | "de",
                });
                if (r.success) toast({ title: "Profile saved" });
                else toast({ title: "Error", description: r.error, variant: "destructive" });
              });
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-sm">Display name</label>
              <Input name="displayName" defaultValue={user.displayName ?? ""} className="mt-1" />
            </div>
            <div>
              <label className="text-sm">Bio</label>
              <Textarea name="bio" defaultValue={user.bio ?? ""} rows={3} className="mt-1" />
            </div>
            <div>
              <label className="text-sm">Language</label>
              <select name="locale" defaultValue={user.locale} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{formatDisplayName(user)}</p>
            <Button type="submit" variant="neon" disabled={pending}>Save profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
          <Button
            variant="outline"
            disabled={pending || password.length < 8}
            onClick={() =>
              startTransition(async () => {
                const r = await updatePassword(password);
                if (r.success) {
                  toast({ title: "Password updated" });
                  setPassword("");
                } else toast({ title: "Error", description: r.error, variant: "destructive" });
              })
            }
          >
            Update password
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Discord</CardTitle></CardHeader>
        <CardContent>
          {user.discordId ? (
            <p className="text-sm text-neon-blue">Discord connected</p>
          ) : (
            <Button variant="outline" asChild>
              <a href={`/api/auth/discord?locale=${locale}`}>Connect Discord</a>
            </Button>
          )}
        </CardContent>
      </Card>

      {!user.hasCreatorProfile && user.role === "USER" && (
        <Card className="glass">
          <CardHeader><CardTitle>Become a Creator</CardTitle></CardHeader>
          <CardContent>
            <Button
              variant="neon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await applyForCreator();
                  if (r.success) {
                    toast({ title: "Creator profile created" });
                    router.push(`/${locale}/creator`);
                    router.refresh();
                  } else toast({ title: "Error", description: r.error, variant: "destructive" });
                })
              }
            >
              Apply as Creator
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
