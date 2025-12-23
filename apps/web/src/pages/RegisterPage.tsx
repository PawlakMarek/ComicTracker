import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await register(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-6 py-12">
      <div className="surface-panel relative z-10 w-full max-w-lg rounded-[40px] px-8 py-10">
        <p className="text-xs uppercase tracking-[0.3em] text-moss-600">ComicTracker</p>
        <h1 className="mt-4 text-3xl font-semibold text-ink-900">Start a clean run log.</h1>
        <p className="mt-2 text-sm text-ink-700">
          Create your account and import your collection without preloaded data.
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-ink-700">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-600">Email</span>
            <input
              className="rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ink-700">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-600">Password</span>
            <input
              className="rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-ember-600">{error}</p> : null}
          <button className="btn-primary" type="submit">
            Create account
          </button>
        </form>

        <p className="mt-6 text-sm text-ink-700">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-ember-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
