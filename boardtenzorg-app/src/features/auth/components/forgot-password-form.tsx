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
import { requestPasswordReset } from "@/features/auth/lib/auth-service";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import Link from "next/link";

type ForgotPasswordFormProps = ComponentPropsWithoutRef<typeof AuthCard>;

export function ForgotPasswordForm(props: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [hasSentEmail, setHasSentEmail] = useState(false);

  const {
    error,
    isLoading,
    run: submitResetRequest,
    reset,
  } = useAsyncAction(async (emailAddress: string) => {
    await requestPasswordReset({
      email: emailAddress,
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setHasSentEmail(true);
  });

  if (hasSentEmail) {
    return (
      <AuthCard
        title="Check Your Email"
        description="Password reset instructions sent"
        {...props}
      >
        <p className="text-sm text-muted-foreground">
          If you registered using your email and password, you will receive a
          password reset email shortly.
        </p>
      </AuthCard>
    );
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (error) {
      reset();
    }
    setEmail(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitResetRequest(email);
  };

  return (
    <AuthCard
      title="Reset Your Password"
      description="Type in your email and we'll send you a link to reset your password"
      footer={
        <div className="w-full text-center text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            Login
          </Link>
        </div>
      }
      {...props}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={handleChange}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send reset email"}
        </Button>
      </form>
    </AuthCard>
  );
}
