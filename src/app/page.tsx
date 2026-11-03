'use client';

import dynamic from 'next/dynamic';

const TourCanvas = dynamic(() => import('@/components/TourCanvas'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#08080a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontFamily: 'sans-serif',
      }}
    >
      Loading 3D Experience...
    </div>
  ),
});

export default function Home() {
  return (
    <main>
      <TourCanvas />
    </main>
  );
}
