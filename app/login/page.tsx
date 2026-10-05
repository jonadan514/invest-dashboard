"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("로그인 정보를 확인해 주세요.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f2eee6] flex items-center justify-center px-5">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173d32] text-xl text-white">
            A
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#24322d]">
            Asset Management
          </h1>
          <p className="mt-2 text-sm text-[#7d857f]">
            우리 집 순자산과 재무계획을 한 곳에서 관리합니다.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-3xl border border-[#ded8cd] bg-[#fffdf8] p-7 shadow-sm"
        >
          <div className="mb-5">
            <p className="text-sm font-semibold text-[#2e3834]">대시보드 접속</p>
            <p className="mt-1 text-xs leading-5 text-[#90958f]">
              Asset Management 계정으로 로그인하세요.
            </p>
          </div>

          <label className="block mb-4">
            <span className="text-xs font-medium text-[#6f7771]">이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-[#ddd8ce] bg-white px-3.5 py-3 text-sm text-[#28312d] outline-none transition focus:border-[#446f60]"
            />
          </label>

          <label className="block mb-5">
            <span className="text-xs font-medium text-[#6f7771]">비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-[#ddd8ce] bg-white px-3.5 py-3 text-sm text-[#28312d] outline-none transition focus:border-[#446f60]"
            />
          </label>

          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#173d32] py-3 text-sm font-semibold text-white transition hover:bg-[#235545] disabled:opacity-60"
          >
            {loading ? "확인 중…" : "접속"}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-[#a0a59f]">
          개인 가계 자산관리용 대시보드
        </p>
      </div>
    </main>
  );
}
