'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Sequence of animations
    const timer1 = setTimeout(() => setStep(1), 500); // "Welcome to" fades in
    const timer2 = setTimeout(() => setStep(2), 1200); // Logo scales in
    const timer3 = setTimeout(() => setStep(3), 2500); // Start exit
    const timer4 = setTimeout(() => {
      setIsVisible(false);
      onFinish();
    }, 3000); // Remove from DOM

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <div 
      className={clsx(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-700 ease-in-out",
        step === 3 ? "opacity-0" : "opacity-100"
      )}
    >
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-[100rem] h-[100rem] bg-blue-100/50 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-indigo-50/50 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <h2 
          className={clsx(
            "text-xl md:text-2xl font-light text-gray-500 mb-6 tracking-[0.2em] uppercase transition-all duration-1000 ease-out transform",
            step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          Welcome to
        </h2>

        <div 
          className={clsx(
            "transition-all duration-1000 ease-out transform",
            step >= 2 ? "opacity-100 scale-100" : "opacity-0 scale-95"
          )}
        >
          <Image 
            src="/logo.png" 
            alt="UxMail Logo" 
            width={180} 
            height={180} 
            className="drop-shadow-2xl"
            priority
          />
        </div>
      </div>
    </div>
  );
}
