import Image from 'next/image'
import { Dongle } from 'next/font/google'

const dongle = Dongle({
  weight: '700',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
})

type BrandLockupProps = {
  tone?: 'dark' | 'light'
  size?: 'compact' | 'standard' | 'large'
  priority?: boolean
  className?: string
}

const SIZE = {
  compact: {
    frame: 'h-7 w-[58px]',
    gap: 'gap-1',
    name: 'text-[15px]',
    company: 'text-[5px]',
    imageSize: '58px',
  },
  standard: {
    frame: 'h-[82px] w-[202px]',
    gap: 'gap-2',
    name: 'text-[30px]',
    company: 'text-[7px]',
    imageSize: '202px',
  },
  large: {
    frame: 'h-36 w-[292px]',
    gap: 'gap-2.5',
    name: 'text-[40px]',
    company: 'text-[9px]',
    imageSize: '292px',
  },
} as const

export default function BrandLockup({
  tone = 'dark',
  size = 'standard',
  priority = false,
  className = '',
}: BrandLockupProps) {
  const styles = SIZE[size]
  const light = tone === 'light'

  return (
    <span className={`inline-flex min-w-0 flex-col items-center ${styles.gap} ${className}`}>
      <span className={`relative shrink-0 overflow-hidden ${styles.frame} ${light ? 'bg-[var(--color-canvas)]' : 'bg-[var(--color-sidebar)]'}`}>
        <Image
          src="/saemhunho-logo-transparent.png"
          alt=""
          fill
          sizes={styles.imageSize}
          priority={priority}
          className="object-contain object-center"
        />
      </span>
      <span className="flex min-w-0 flex-col items-center justify-center leading-none">
        <span className={`${dongle.className} block whitespace-nowrap tracking-[0.04em] ${styles.name} ${light ? 'text-[var(--color-ink)]' : 'text-white'}`}>
          샘훈호
        </span>
        <span className={`mt-1 block whitespace-nowrap font-semibold tracking-[0.28em] ${styles.company} ${light ? 'text-[#9b7b43]' : 'text-[#d8bc83]'}`}>
          FAMILY OFFICE
        </span>
      </span>
    </span>
  )
}
