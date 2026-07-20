import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import AssetRow from './AssetRow'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assets = [] } = await supabase
    .from('assets')
    .select('*')
    .order('asset_class')
    .order('name')

  const noSymbol = (assets ?? []).filter((a: any) => !a.symbol)

  return (
    <AppShell>
      <div className="p-6 max-w-2xl">
        <h1 className="text-lg font-bold text-[#34322b] mb-1">종목 관리</h1>
        <p className="text-xs text-[#9c9484] mb-6">심볼을 입력해야 시세가 자동으로 조회됩니다</p>

        {noSymbol.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700">
            ⚠ 심볼 미입력 종목 {noSymbol.length}개 — 아래에서 클릭해서 입력하세요
          </div>
        )}

        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden">
          {(assets ?? []).length === 0 ? (
            <p className="text-sm text-[#9c9484] text-center py-10">등록된 종목이 없습니다</p>
          ) : (
            (assets as any[]).map((asset: any) => (
              <AssetRow key={asset.id} asset={asset} />
            ))
          )}
        </div>

        <div className="mt-4 bg-[#faf6ec] border border-[#e3d9c4] rounded-xl p-4 text-xs text-[#9c9484] space-y-1">
          <p className="font-semibold text-[#34322b] mb-2">심볼 입력 가이드</p>
          <p>🇰🇷 국내주식/ETF → 6자리 종목코드 (예: <span className="font-mono text-[#34322b]">005930</span>)</p>
          <p className="ml-3 text-[#b5aa98]">KOSDAQ 종목은 <span className="font-mono">종목코드.KQ</span> 형태로 입력</p>
          <p>🇺🇸 미국주식/ETF → 티커 (예: <span className="font-mono text-[#34322b]">AAPL</span>, <span className="font-mono text-[#34322b]">QQQ</span>)</p>
          <p>🪙 코인 → 업비트 기준 (예: <span className="font-mono text-[#34322b]">BTC</span>, <span className="font-mono text-[#34322b]">ETH</span>)</p>
        </div>
      </div>
    </AppShell>
  )
}
