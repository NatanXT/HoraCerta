import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { authService } from '../services/auth.service';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Não foi possível processar a solicitação no momento. Tente novamente mais tarde.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[var(--hc-surface)] backdrop-blur-md border border-[var(--hc-border)] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] mb-4 border border-[var(--hc-accent-border)]">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--hc-text)]">Recuperar Senha</h1>
          <p className="text-sm text-[var(--hc-text-secondary)] mt-1">
            Digite seu e-mail para receber as instruções de recuperação.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-rose-500 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Verifique sua caixa de entrada</p>
                <p className="text-xs leading-relaxed opacity-90">
                  Se o e-mail estiver cadastrado em nosso sistema, você receberá um link de recuperação em instantes. O link é válido por 20 minutos.
                </p>
              </div>
            </div>

            <Link
              to="/login"
              className="w-full py-3.5 px-4 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-[var(--hc-accent-foreground)] font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-2">
                E-mail cadastrado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--hc-text-muted)]">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full pl-11 pr-4 py-3 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text)] placeholder-[var(--hc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)] transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 disabled:opacity-50 text-[var(--hc-accent-foreground)] font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </Link>
            </div>
          </form>
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

