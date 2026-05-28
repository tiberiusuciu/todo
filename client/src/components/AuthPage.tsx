import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, registrationCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-8 text-center text-2xl font-medium text-zinc-100">Todos</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoComplete="email"
          className="rounded-lg bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="rounded-lg bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        />

        {mode === "register" && (
          <input
            type="text"
            value={registrationCode}
            onChange={(e) => setRegistrationCode(e.target.value)}
            placeholder="Invite code"
            required
            autoComplete="off"
            spellCheck={false}
            className="rounded-lg bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          />
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-lg bg-zinc-100 py-3 text-base font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {submitting ? "..." : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError(null);
        }}
        className="mt-4 text-center text-sm text-zinc-500 hover:text-zinc-300"
      >
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
