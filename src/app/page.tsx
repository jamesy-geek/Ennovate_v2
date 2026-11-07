'use client';

import dynamic from 'next/dynamic';

const TourCanvas = dynamic(() => import('@/components/TourCanvas'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#08080a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontFamily: 'sans-serif',
        position: 'fixed',
        zIndex: 100,
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

