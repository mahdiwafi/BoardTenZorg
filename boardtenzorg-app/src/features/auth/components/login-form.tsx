"use client";

import { type ComponentPropsWithoutRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/features/auth/components/auth-card";
import { signInWithPassword } from "@/features/auth/lib/auth-service";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import Link from "next/link";
import { useRouter } from "next/navigation";

const AUTHENTICATED_REDIRECT = "/profile";

type LoginFormProps = ComponentPropsWithoutRef<typeof AuthCard>;

export function LoginForm(props: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const {
    error,
    isLoading,
    run: submitLogin,
    reset,
  } = useAsyncAction(
    async ({ email, password }: { email: string; password: string }) => {
      await signInWithPassword({ email, password });
      router.push(AUTHENTICATED_REDIRECT);
    },
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitLogin({ email, password });
  };

  return (
    <AuthCard
      title="Login"
      description="Enter your email below to login to your account"
      footer={
        <div className="w-full text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className="underline underline-offset-4">
            Sign up
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
            onChange={(event) => {
              if (error) {
                reset();
              }
              setEmail(event.target.value);
            }}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              if (error) {
                reset();
              }
              setPassword(event.target.value);
            }}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
      </form>
    </AuthCard>
  );
}
