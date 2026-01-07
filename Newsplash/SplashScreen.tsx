'use client';

import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [showText, setShowText] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 1. Texten tonas in snabbt
    const t1 = setTimeout(() => setShowText(true), 150);
    
    // 2. Logon tonas in mjukt kort därefter
    const t2 = setTimeout(() => setShowLogo(true), 800);
    
    // 3. Hela skärmen tonas ut lugnt
    const t3 = setTimeout(() => setIsExiting(true), 2600);
    
    // 4. Ta bort komponenten efter att ut-toningen är klar
    const t4 = setTimeout(() => {
      onFinish();
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinish]);

  return (
    <div 
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-white transition-opacity duration-1000 ease-in-out ${
        isExiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center">
        {/* TEXT - "Welcome to" */}
        <h2
          className={`text-lg md:text-xl tracking-[0.3em] uppercase font-light text-gray-400 transition-opacity duration-1000 ease-in-out ${
            showText ? "opacity-100" : "opacity-0"
          }`}
        >
          Welcome to
        </h2>

        {/* LOGO - Större och närmare texten */}
        <div
          className={`mt-4 transition-opacity duration-1000 ease-in-out ${
            showLogo ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src="/logo.png"
            alt="Logo"
            style={{ 
              width: '240px', // Gjort logon större (var 160px tidigare)
              height: 'auto',
              display: 'block'
            }}
          />
        </div>
      </div>
    </div>
  );
}