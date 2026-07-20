export async function fetchUsdKrw(): Promise<number> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=KRW', {
      next: { revalidate: 3600 }, // 1시간 캐시
    })
    if (!res.ok) return 0
    const data = await res.json() as { rates?: { KRW?: number } }
    return data.rates?.KRW ?? 0
  } catch {
    return 0
  }
}
