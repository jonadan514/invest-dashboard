import { getHouseholdContext } from '@/lib/supabase/server'
import AssetRow from './AssetRow'
import type { Asset } from '@/lib/types'

export default async function AssetsPage() {
  const { supabase, userId } = await getHouseholdContext()

  const { data: assets = [] } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', userId)
    .order('asset_class')
    .order('name')
    .throwOnError()

  const typedAssets = (assets ?? []) as Asset[]
  const noSymbol = typedAssets.filter(asset => !asset.symbol)

  return (
    <>
      <div className="page-container max-w-2xl">
        <h1 className="page-title">종목 관리</h1>
        <p className="page-subtitle mb-6">거래에 사용한 종목과 자동 시세 조회용 심볼을 관리합니다.</p>

        {noSymbol.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            심볼 미입력 종목 {noSymbol.length}개 · 아래 목록에서 심볼을 입력해 주세요.
          </div>
        )}

        <div className="app-card overflow-hidden">
          {typedAssets.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-muted)]">등록된 종목이 없습니다</p>
          ) : (
            typedAssets.map(asset => (
              <AssetRow key={asset.id} asset={asset} />
            ))
          )}
        </div>

        <div className="app-card mt-4 space-y-1 p-4 text-xs text-[var(--color-muted)]">
          <p className="mb-2 font-semibold text-[var(--color-ink)]">심볼 입력 가이드</p>
          <p><span className="font-semibold text-[var(--color-ink)]">국내</span> · 6자리 종목코드 (예: <span className="font-mono text-[var(--color-ink)]">005930</span>)</p>
          <p className="pl-9 text-[var(--color-subtle)]">KOSDAQ은 <span className="font-mono">종목코드.KQ</span> 형태로 입력</p>
          <p><span className="font-semibold text-[var(--color-ink)]">미국</span> · 티커 (예: <span className="font-mono text-[var(--color-ink)]">AAPL</span>, <span className="font-mono text-[var(--color-ink)]">QQQ</span>)</p>
          <p><span className="font-semibold text-[var(--color-ink)]">코인</span> · 업비트 기준 (예: <span className="font-mono text-[var(--color-ink)]">BTC</span>, <span className="font-mono text-[var(--color-ink)]">ETH</span>)</p>
        </div>
      </div>
    </>
  )
}
