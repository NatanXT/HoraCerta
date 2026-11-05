import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { authService } from '../services/auth.service';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    if (!token) {
      setError('Token de recuperação não fornecido ou link inválido.');
      return;
    }

    if (password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem. Digite a mesma senha nos dois campos.');
      return;
    }

    setSubmitting(true);

    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      // Remove o token da URL via React Router preservando o histórico de navegação
      setSearchParams({}, { replace: true });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      let message = err?.response?.data?.message || err?.response?.data?.error;

      if (code === 'TOKEN_EXPIRED') {
        message = 'Este link de recuperação expirou. Por favor, solicite um novo link.';
      } else if (code === 'TOKEN_ALREADY_USED') {
        message = 'Este link de recuperação já foi utilizado. Caso precise, solicite um novo link.';
      } else if (code === 'INVALID_TOKEN') {
        message = 'Link de recuperação inválido ou inexistente.';
      }

      setError(message || 'Erro ao redefinir senha. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[var(--hc-surface)] backdrop-blur-md border border-[var(--hc-border)] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] mb-4 border border-[var(--hc-accent-border)]">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--hc-text)]">Redefinir Senha</h1>
          <p className="text-sm text-[var(--hc-text-secondary)] mt-1">
            Digite sua nova senha de acesso
          </p>
        </div>

        {!token && !success && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Link inválido ou ausente</p>
                <p className="text-xs leading-relaxed opacity-90">
                  O link acessado não possui o código de recuperação necessário. Solicite um novo link de redefinição de senha.
                </p>
              </div>
            </div>

            <Link
              to="/esqueci-senha"
              className="w-full py-3.5 px-4 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-[var(--hc-accent-foreground)] font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              Solicitar novo link
            </Link>
          </div>
        )}

        {success && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Senha atualizada com sucesso!</p>
                <p className="text-xs leading-relaxed opacity-90">
                  Sua senha foi redefinida. Por segurança, todas as sessões anteriores foram desconectadas.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-3.5 px-4 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-[var(--hc-accent-foreground)] font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              Ir para o Login
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {token && !success && (
          <>
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-rose-500 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--hc-text-muted)]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    minLength={8}
                    className="w-full pl-11 pr-4 py-3 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text)] placeholder-[var(--hc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)] transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-2">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--hc-text-muted)]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    minLength={8}
                    className="w-full pl-11 pr-4 py-3 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text)] placeholder-[var(--hc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)] transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 disabled:opacity-50 text-[var(--hc-accent-foreground)] font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {submitting ? 'Salvando nova senha...' : 'Atualizar senha'}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 text-center pt-6 border-t border-[var(--hc-border)]">
          <p className="text-sm text-[var(--hc-text-secondary)]">
            Lembrou sua senha?{' '}
            <Link
              to="/login"
              className="text-[var(--hc-accent)] hover:opacity-85 font-medium transition-colors"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

