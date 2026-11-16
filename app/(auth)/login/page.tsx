"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "An account with this email already exists and was created with a password. Sign in with your email and password instead of Google.",
  AccessDenied: "Access denied.",
  RateLimited: "Too many attempts. Please wait a few minutes and try again.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const urlError = params.get("error");
  const urlErrorMessage = urlError
    ? AUTH_ERRORS[urlError] ?? "Sign-in failed. Please try again."
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      toast.error(AUTH_ERRORS[res.error] ?? "Invalid email or password");
      return;
    }
    toast.success("Welcome back!");
    router.push(params.get("callbackUrl") ?? "/projects");
    router.refresh();
  }

  async function handleDemoLogin() {
    setDemoLoading(true);
    const res = await signIn("demo", { redirect: false });
    setDemoLoading(false);

    if (res?.error) {
      toast.error("Demo sign-in failed. Please try again.");
      return;
    }
    toast.success("Welcome to the demo!");
    router.push(params.get("callbackUrl") ?? "/projects");
    router.refresh();
  }

  return (
    <Card className="p-6">
      {urlErrorMessage && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {urlErrorMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => signIn("google", { callbackUrl: "/projects" })}
      >
        Continue with Google
      </Button>

      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
        <>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={handleDemoLogin}
            loading={demoLoading}
          >
            Try Demo — No account needed
          </Button>
          <p className="mt-2 text-center text-xs text-slate-400">
            Demo data is shared and resets periodically
          </p>
        </>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        No account?{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          Create one
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
