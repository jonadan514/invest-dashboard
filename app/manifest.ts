import type { MetadataRoute } from 'next'

/** 휴대폰 홈 화면에 추가했을 때 앱처럼(주소창 없이) 열리게 하는 정보. 로그인 전에도 읽혀야 한다(proxy.ts). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '샘훈호 FAMILY OFFICE',
    short_name: '샘훈호',
    description: '가족 자산·월말 기록 대시보드',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eef1f5',
    theme_color: '#172b46',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '이번 달 기록하기', short_name: '월간 기록', url: '/budget', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: '주식 현재가 입력', short_name: '현재가', url: '/stocks?tab=prices', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
