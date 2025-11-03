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
import { signUpWithEmail } from "@/features/auth/lib/auth-service";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SignUpFormProps = ComponentPropsWithoutRef<typeof AuthCard>;

export function SignUpForm(props: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();

  const {
    error: submitError,
    isLoading,
    run: submitSignUp,
    reset,
  } = useAsyncAction(
    async ({ email, password }: { email: string; password: string }) => {
      await signUpWithEmail({
        email,
        password,
        redirectTo: `${window.location.origin}/profile`,
      });
      router.push("/auth/sign-up-success");
    },
  );

  const combinedError = localError ?? submitError;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== repeatPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    setLocalError(null);
    await submitSignUp({ email, password });
  };

  const handleFieldChange =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (localError || submitError) {
        setLocalError(null);
        reset();
      }
      setter(event.target.value);
    };

  return (
    <AuthCard
      title="Sign up"
      description="Create a new account"
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
            autoComplete="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={handleFieldChange(setEmail)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={handleFieldChange(setPassword)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="repeat-password">Repeat Password</Label>
          <Input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            required
            value={repeatPassword}
            onChange={handleFieldChange(setRepeatPassword)}
          />
        </div>
        {combinedError ? (
          <p className="text-sm text-destructive">{combinedError}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating an account..." : "Sign up"}
        </Button>
      </form>
    </AuthCard>
  );
}
