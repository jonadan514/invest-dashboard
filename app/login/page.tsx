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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen bg-[#ece5d6]">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold text-[#34322b] mb-1">
          🌿 우리집 투자 대시보드
        </h1>
        <p className="text-sm text-[#9c9484] mb-6">로그인하고 시작하세요</p>

        <label className="block mb-3">
          <span className="text-xs text-[#9c9484]">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-[#e3d9c4] bg-[#f4eee0] px-3 py-2 text-sm text-[#34322b] outline-none focus:border-[#1c6b4a]"
          />
        </label>
        <label className="block mb-5">
          <span className="text-xs text-[#9c9484]">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-[#e3d9c4] bg-[#f4eee0] px-3 py-2 text-sm text-[#34322b] outline-none focus:border-[#1c6b4a]"
          />
        </label>

        {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#1c6b4a] hover:bg-[#258a60] text-white text-sm font-medium py-2.5 disabled:opacity-60"
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
