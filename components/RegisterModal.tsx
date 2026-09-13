"use client";

import { useRef, useState } from "react";
import { X, UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useAuth } from "@/contexts/AuthContext";

const HCAPTCHA_TEST_SITE_KEY = "10000000-ffff-ffff-ffff-000000000001";

const isLikelyValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function RegisterModal() {
  const { mode, close, openLogin } = useAuthModal();
  const { setUser } = useAuth();
  const isOpen = mode === "register";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const captchaRef = useRef<HCaptcha>(null);

  if (!isOpen) return null;

  const canSubmit =
    username.trim().length > 0 &&
    isLikelyValidEmail(email) &&
    password.length > 0 &&
    agreedToTerms &&
    captchaToken !== null;

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setAffiliateCode("");
    setAgreedToTerms(false);
    setCaptchaToken(null);
    setErrorMessage(null);
    captchaRef.current?.resetCaptcha();
  };

  const handleClose = () => {
    resetForm();
    close();
  };

  const handleSwitchToLogin = () => {
    resetForm();
    openLogin();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("http://localhost:3001/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Without this, the browser will silently ignore any Set-Cookie
        // header the backend sends back, even though CORS allows it.
        // "include" tells fetch: "yes, store and send cookies for this
        // cross-origin request."
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Immediately update the app's logged-in state — no need to wait
      // for a page refresh or a fresh /users/me call.
      setUser(data);
      handleClose();
    } catch (err) {
      setErrorMessage("Could not reach the server. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card w-full max-w-md bg-surface border border-border rounded-2xl p-6 relative shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto chat-scrollbar"
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-5 right-5 text-muted hover:text-foreground transition-colors duration-200"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500">
            <UserPlus size={16} className="text-white" />
          </span>
          <h2 className="text-lg font-display font-bold text-foreground">
            Register
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="register-username"
              className="block text-sm font-medium text-muted mb-2"
            >
              Username
            </label>
            <input
              id="register-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20 transition-all duration-200"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-sm font-medium text-muted mb-2"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20 transition-all duration-200"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-sm font-medium text-muted mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 pr-11 text-sm text-foreground placeholder:text-muted outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors duration-200"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="register-affiliate"
              className="block text-sm font-medium text-muted mb-2"
            >
              Affiliate code (optional)
            </label>
            <input
              id="register-affiliate"
              type="text"
              value={affiliateCode}
              onChange={(e) => setAffiliateCode(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20 transition-all duration-200"
            />
          </div>

          <div className="flex justify-start">
            <HCaptcha
              ref={captchaRef}
              sitekey={HCAPTCHA_TEST_SITE_KEY}
              theme="dark"
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
            />
          </div>

          <label className="flex items-start gap-2.5 text-sm text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border bg-background accent-violet-500 cursor-pointer"
            />
            <span>
              I agree to the{" "}
              <button
                type="button"
                className="font-medium text-violet-400 hover:text-violet-300 transition-colors duration-200 underline underline-offset-2"
              >
                Terms &amp; Conditions
              </button>
            </span>
          </label>

          {errorMessage && (
            <p className="text-sm text-red-400 text-center">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-violet-500 disabled:hover:to-indigo-500 text-white text-sm font-semibold rounded-lg py-3 transition-all duration-200"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating account...
              </>
            ) : (
              "Register"
            )}
          </button>

          <p className="text-sm text-muted text-center">
            Already have an account?{" "}
            <button
              type="button"
              onClick={handleSwitchToLogin}
              className="font-semibold text-violet-400 hover:text-violet-300 transition-colors duration-200 underline underline-offset-2"
            >
              Log in here!
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}