"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser, supabaseConfig } from "@/lib/supabase";
import { SetupScreen } from "@/components/SetupScreen";

type Mode = "entrar" | "criar" | "recuperar";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!supabaseConfig()) return <SetupScreen />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowser();
    if (!supabase) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (mode === "recuperar") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) throw resetError;
        setMessage("Enviamos um link de redefinição para o e-mail, se a conta existir.");
        return;
      }
      if (mode === "criar") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage("Conta criada. Confirme o e-mail para entrar. Se quiser pular essa etapa, desative a confirmação de e-mail no Supabase.");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
      router.push("/");
      router.refresh();
    } catch (caught) {
      const text =
        caught && typeof caught === "object" && "message" in caught
          ? String((caught as { message: unknown }).message)
          : "Não consegui entrar.";
      setError(text);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">Kommo</p>
      <h1 className="mt-2 font-serif text-4xl">Entrar nos leads</h1>
      <p className="mt-3 text-sm text-mute">
        Quem entra vê e edita os mesmos lançamentos. Sem login, a dashboard não abre.
      </p>
      <div className="mt-6 flex gap-2">
        {(
          [
            ["entrar", "Entrar"],
            ["criar", "Criar conta"],
            ["recuperar", "Esqueci a senha"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${mode === id ? "chip-on" : ""}`} onClick={() => { setMode(id); setError(""); setMessage(""); }}>
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="panel mt-4 space-y-3 p-5">
        <label className="block text-sm">
          E-mail
          <input
            className="field mt-1"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {mode !== "recuperar" && (
          <label className="block text-sm">
            Senha
            <input
              className="field mt-1"
              type="password"
              autoComplete={mode === "criar" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        {mode === "criar" && (
          <p className="text-sm text-mute">
            Depois da primeira conta, desative novas inscrições em Authentication no Supabase. Assim só quem você convidar vê os telefones.
          </p>
        )}
        {error && <p className="text-sm text-wine">{error}</p>}
        {message && <p className="text-sm text-pine">{message}</p>}
        <button className="btn btn-primary w-full" type="submit" disabled={pending}>
          {pending ? "Aguarde" : mode === "criar" ? "Criar conta" : mode === "recuperar" ? "Enviar link" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
