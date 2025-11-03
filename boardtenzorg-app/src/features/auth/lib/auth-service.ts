"use client";

import { createClient } from "@/lib/supabase/client";

type EmailCredentials = {
  email: string;
  password: string;
};

type ResetPasswordParams = {
  email: string;
  redirectTo: string;
};

type SignUpParams = EmailCredentials & {
  redirectTo: string;
};

export async function signInWithPassword({ email, password }: EmailCredentials) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signUpWithEmail({
  email,
  password,
  redirectTo,
}: SignUpParams) {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function requestPasswordReset({
  email,
  redirectTo,
}: ResetPasswordParams) {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePassword(password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw new Error(error.message);
  }
}
