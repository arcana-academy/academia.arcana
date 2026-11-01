import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./AuthForm";

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
      updateUser,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("AuthForm", () => {
  it("shows approved visual login layout without replacing authentication actions", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("heading", { name: "Entre no seu santuário de estudos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Esqueci minha senha" }).getAttribute("href")).toBe("/recuperar-senha");
    expect(screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")).toBe("/cadastro");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("retains password recovery without offering new accounts in personal mode", () => {
    render(<AuthForm mode="login" showSignUpLink={false} />);
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Criar conta" })).toBeNull();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    signInWithPassword.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
  });

  it("links from login to the existing password recovery flow only in login mode", () => {
    const { rerender } = render(<AuthForm mode="login" />);
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute(
      "href",
      "/recuperar-senha",
    );

    rerender(<AuthForm mode="signup" />);
    expect(screen.queryByRole("link", { name: "Esqueci minha senha" })).not.toBeInTheDocument();
  });

  it("submits login credentials and redirects to the sanctuary after success", async () => {
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "correct-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "student@example.com",
        password: "correct-password",
      });
      expect(push).toHaveBeenCalledWith("/santuario");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows a non-sensitive error when login fails", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: new Error("Invalid login credentials"),
    });

    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "wrong-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Não foi possível concluir a operação. Tente novamente.",
      );
    });
  });

  it("does not enumerate accounts during password recovery", async () => {
    render(<AuthForm mode="recover" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar instruções" }),
    );

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "student@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining(
            "/auth/callback?next=/redefinir-senha",
          ),
        }),
      );

      expect(screen.getByRole("alert").textContent).toContain(
        "Se o endereço estiver cadastrado, você receberá as instruções para recuperar o acesso.",
      );
    });
  });

  it("requires matching passwords before updating them", async () => {
    render(<AuthForm mode="update-password" />);

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "new-password" },
    });

    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "different-password" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Atualizar senha" }),
    );

    expect(updateUser).not.toHaveBeenCalled();

    expect(screen.getByRole("alert").textContent).toContain(
      "As senhas precisam ser iguais.",
    );
  });

  it("rejects a password shorter than eight characters when updating", async () => {
    render(<AuthForm mode="update-password" />);

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "1234567" },
    });

    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "1234567" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Atualizar senha" }),
    );

    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "A senha precisa ter pelo menos 8 caracteres.",
    );
  });

  it("shows approved signup and recovery designs with real navigation", () => {
    const { unmount } = render(<AuthForm mode="signup" />);
    expect(screen.getByRole("heading", { name: "Comece sua jornada" })).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    unmount();
    render(<AuthForm mode="recover" />);
    expect(screen.getByRole("heading", { name: "Recuperar acesso" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByText(/não confirmamos se um endereço está cadastrado/i)).toBeInTheDocument();
  });

  it("blocks signup when password confirmation differs without calling Supabase", async () => {
    render(<AuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "correct-password" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "other-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("As senhas precisam ser iguais.");
  });

  it("uses the existing Supabase signup when passwords match", async () => {
    render(<AuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "correct-password" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
        email: "student@example.com", password: "correct-password",
        options: expect.objectContaining({ emailRedirectTo: expect.stringContaining("/auth/callback?next=/") }),
      }));
    });
  });

  it("rejects a password shorter than eight characters during signup", async () => {
    render(<AuthForm mode="signup" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "1234567" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta" }),
    );

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "A senha precisa ter pelo menos 8 caracteres.",
    );
  });

  it("redirects an immediately authenticated signup to the Santuário", async () => {
    signUp.mockResolvedValueOnce({
      data: { session: { access_token: "test-session" } },
      error: null,
    });

    render(<AuthForm mode="signup" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "secure-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/santuario");
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("does not redirect signup when email confirmation is pending", async () => {
    render(<AuthForm mode="signup" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "secure-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Verifique seu email para confirmar o acesso",
      );
    });

    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("updates the password when confirmation matches", async () => {
    render(<AuthForm mode="update-password" />);

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "new-password" },
    });

    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "new-password" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Atualizar senha" }),
    );

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledTimes(1);
      expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
      expect(screen.getByRole("alert").textContent).toContain(
        "Senha atualizada com sucesso.",
      );
    });

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
