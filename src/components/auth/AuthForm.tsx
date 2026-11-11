"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { CaptchaChallenge, type AuthCaptchaProvider } from "./CaptchaChallenge";

type AuthMode = "login" | "signup" | "recover" | "update-password";

type AuthFormProps = {
  mode: AuthMode;
};

const COPY: Record<AuthMode, { title: string; submit: string }> = {
  login: { title: "Entrar", submit: "Entrar" },
  signup: { title: "Criar conta", submit: "Criar conta" },
  recover: {
    title: "Recuperar acesso",
    submit: "Enviar instruções",
  },
  "update-password": {
    title: "Definir nova senha",
    submit: "Atualizar senha",
  },
};

const GENERIC_AUTH_ERROR =
  "Não foi possível concluir a operação. Tente novamente.";

const MIN_PASSWORD_LENGTH = 8;

const PASSWORD_TOO_SHORT_ERROR =
  "A senha precisa ter pelo menos 8 caracteres.";

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaGeneration, setCaptchaGeneration] = useState(0);

  const configuredProvider = process.env.NEXT_PUBLIC_AUTH_CAPTCHA_PROVIDER;
  const captchaProvider: AuthCaptchaProvider | null =
    configuredProvider === "turnstile" || configuredProvider === "hcaptcha"
      ? configuredProvider
      : null;
  const captchaSiteKey = process.env.NEXT_PUBLIC_AUTH_CAPTCHA_SITE_KEY?.trim() ?? "";
  const captchaEnabled = Boolean(captchaProvider && captchaSiteKey);
  const captchaMisconfigured = Boolean(configuredProvider || captchaSiteKey) && !captchaEnabled;
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (mode !== "update-password" && captchaMisconfigured) {
      setStatus("error");
      setMessage("A verificação de segurança está indisponível. Tente novamente mais tarde.");
      return;
    }

    if (mode !== "update-password" && captchaEnabled && !captchaToken) {
      setStatus("error");
      setMessage("Conclua a verificação de segurança antes de continuar.");
      return;
    }

    try {
      const supabase = createClient();
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
          ...(captchaEnabled && captchaToken ? { captchaToken } : {}),
        });

        if (error) {
          throw error;
        }

        setStatus("success");
        setMessage(
          "Se o endereço estiver cadastrado, você receberá as instruções para recuperar o acesso.",
        );
        return;
      }

      if (mode === "update-password") {
        if (password !== confirmPassword) {
          setStatus("error");
          setMessage("As senhas precisam ser iguais.");
          return;
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
          setStatus("error");
          setMessage(PASSWORD_TOO_SHORT_ERROR);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          throw error;
        }

        setStatus("success");
        setMessage("Senha atualizada com sucesso.");
        return;
      }

      if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
        setStatus("error");
        setMessage(PASSWORD_TOO_SHORT_ERROR);
        return;
      }

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setStatus("error");
          setMessage("As senhas precisam ser iguais.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
            ...(captchaEnabled && captchaToken ? { captchaToken } : {}),
          },
        });

        if (error) {
          throw error;
        }

        setStatus("success");
        if (data.session) {
          setMessage("Conta criada com sucesso.");
          router.push("/santuario");
          router.refresh();
        } else {
          setMessage(
            "Conta criada. Verifique seu email para confirmar o acesso, se a confirmação estiver habilitada.",
          );
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(captchaEnabled && captchaToken ? { options: { captchaToken } } : {}),
      });

      if (error) {
        throw error;
      }

      setStatus("success");
      router.push("/santuario");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        (error as { code?: string } | null)?.code === "captcha_failed"
          ? "Falha na verificação de segurança. Conclua uma nova verificação e tente novamente."
          : GENERIC_AUTH_ERROR,
      );
    } finally {
      if (mode !== "update-password" && captchaEnabled) {
        setCaptchaToken(null);
        setCaptchaGeneration((value) => value + 1);
      }
    }
  }

  const copy = COPY[mode];
  const passwordInputType = showPassword ? "text" : "password";

  return (
    <main className={mode === "update-password" ? "aa-auth-screen" : `aa-auth-screen aa-auth-login aa-auth-${mode}`} aria-labelledby="auth-title">
      {mode !== "update-password" ? (
        <aside className="aa-auth-story" aria-hidden="true">
          <div className="aa-auth-story-copy">
            <span className="aa-auth-story-sigil">✧</span>
            <p>Academia Arcana</p>
            <strong>{mode === "login" ? "Um universo de estudos para descobrir." : "Conhecimento também é uma forma de magia."}</strong>
          </div>
        </aside>
      ) : null}
      <div className="aa-auth-card">
        <div className="aa-auth-card-brand">
          <Image src="/assets/brand/aa-institutional-seal.svg" alt="" width={64} height={64} priority />
          <span>Academia Arcana</span>
        </div>
        <h1 id="auth-title">{mode === "login" ? "Entre no seu santuário de estudos" : mode === "signup" ? "Comece sua jornada" : copy.title}</h1>
        {mode === "login" ? (
          <p className="aa-auth-welcome">Continue sua jornada e organize seus conhecimentos em um só lugar.</p>
        ) : mode === "signup" ? (
          <p className="aa-auth-welcome">Crie seu espaço para aprender e registrar seus conhecimentos.</p>
        ) : mode === "recover" ? (
          <p className="aa-auth-welcome">Informe seu e-mail para receber instruções, se houver uma conta associada.</p>
        ) : null}

      <form className="aa-auth-form" onSubmit={handleSubmit} noValidate>
        {mode !== "update-password" && (
          <div>
            <label htmlFor={emailId}>Email</label>
            <input
              className="aa-auth-input"
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={status === "error"}
            />
          </div>
        )}

        {mode !== "recover" && (
          <div>
            <label htmlFor={passwordId}>Senha</label>
            <input
              className="aa-auth-input"
              id={passwordId}
              name="password"
              type={passwordInputType}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={status === "error"}
            />

            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-pressed={showPassword}
            >
              {showPassword ? "Ocultar senha" : "Mostrar senha"}
            </button>
          </div>
        )}

        {(mode === "update-password" || mode === "signup") && (
          <div>
            <label htmlFor={confirmPasswordId}>Confirmar senha</label>
            <input
              className="aa-auth-input"
              id={confirmPasswordId}
              name="confirm-password"
              type={passwordInputType}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={status === "error"}
            />
          </div>
        )}

        {mode !== "update-password" && captchaEnabled && captchaProvider ? (
          <CaptchaChallenge
            key={`${mode}-${captchaGeneration}`}
            provider={captchaProvider}
            siteKey={captchaSiteKey}
            onTokenChange={setCaptchaToken}
          />
        ) : null}

        {message && (
          <p role="alert" aria-live="polite">
            {message}
          </p>
        )}

        <button className="aa-auth-submit" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Processando…" : copy.submit}
        </button>
      </form>
      {mode === "login" ? (
        <nav className="aa-auth-secondary-links" aria-label="Opções de acesso">
          <Link href="/recuperar-senha">Esqueci minha senha</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cadastro">Criar conta</Link>
        </nav>
      ) : null}
      {mode === "signup" ? (
        <p className="aa-auth-authlink">Já tem conta? <Link href="/login">Entrar</Link></p>
      ) : null}
      {mode === "recover" ? (
        <p className="aa-auth-authlink"><Link href="/login">Voltar ao Login</Link></p>
      ) : null}
      {mode === "login" ? (
        <p className="aa-auth-privacy-note">Seu acesso utiliza a autenticação segura existente da Academia Arcana.</p>
      ) : mode === "signup" ? (
        <p className="aa-auth-privacy-note">A confirmação de e-mail protege seu acesso quando estiver habilitada.</p>
      ) : mode === "recover" ? (
        <p className="aa-auth-privacy-note">Por privacidade, não confirmamos se um endereço está cadastrado.</p>
      ) : null}
      </div>
    </main>
  );
}
