'use client'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

type AssetOption = { id: string; name: string; symbol: string | null; count: number }

export default function AssetFilter({ assets }: { assets: AssetOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('asset_id')

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set('asset_id', id)
    else params.delete('asset_id')
    router.push(`${pathname}?${params.toString()}`)
  }

  if (assets.length === 0) return null

  return (
    <div className="flex gap-1.5 flex-wrap">
      <button
        onClick={() => select(null)}
        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
          !current
            ? 'bg-[#34322b] text-white border-[#34322b]'
            : 'bg-[#faf6ec] text-[#9c9484] border-[#e3d9c4] hover:border-[#9c9484] hover:text-[#34322b]'
        }`}
      >
        전체
      </button>
      {assets.map(a => (
        <button
          key={a.id}
          onClick={() => select(a.id)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            current === a.id
              ? 'bg-[#1c6b4a] text-white border-[#1c6b4a]'
              : 'bg-[#faf6ec] text-[#9c9484] border-[#e3d9c4] hover:border-[#9c9484] hover:text-[#34322b]'
          }`}
        >
          {a.name}
          {a.symbol && (
            <span className="ml-1.5 opacity-60 text-[10px] font-mono">{a.symbol}</span>
          )}
          <span className={`ml-1.5 text-[10px] ${current === a.id ? 'opacity-70' : 'text-[#b5aa98]'}`}>
            {a.count}
          </span>
        </button>
      ))}
    </div>
  )
}
