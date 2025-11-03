"use client";

import {
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/features/auth/components/auth-card";
import { updatePassword } from "@/features/auth/lib/auth-service";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { useRouter } from "next/navigation";

type UpdatePasswordFormProps = ComponentPropsWithoutRef<typeof AuthCard>;

export function UpdatePasswordForm(props: UpdatePasswordFormProps) {
  const [password, setPassword] = useState("");
  const router = useRouter();

  const {
    error,
    isLoading,
    run: submitUpdate,
    reset,
  } = useAsyncAction(async (newPassword: string) => {
    await updatePassword(newPassword);
    router.push("/profile");
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (error) {
      reset();
    }
    setPassword(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitUpdate(password);
  };

  return (
    <AuthCard
      title="Reset Your Password"
      description="Please enter your new password below."
      {...props}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            required
            value={password}
            onChange={handleChange}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </AuthCard>
  );
}
