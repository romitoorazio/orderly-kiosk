import React from 'react';
import { LOGO_URL } from '@/lib/constants';
import { BUSINESS } from '@/config/business';

interface WelcomeScreenProps {
  onStart: () => void;
  logoError: boolean;
  onLogoError: () => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  logoError,
  onLogoError,
  onLongPressStart,
  onLongPressEnd,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen w-full bg-background relative overflow-hidden"
      onClick={onStart}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
      onMouseDown={onLongPressStart}
      onMouseUp={onLongPressEnd}
    >
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 flex flex-col items-center gap-12 animate-fade-in">
        {/* Logo */}
        <div className="w-72 h-72 md:w-96 md:h-96 rounded-full overflow-hidden kiosk-shadow animate-pulse-glow border-4 border-slate-100 bg-white p-2">
          {!logoError ? (
            <img
              src={LOGO_URL}
              alt={`Logo ${BUSINESS.name}`}
              className="w-full h-full object-contain rounded-full"
              onError={onLogoError}
            />
          ) : (
            <div className="w-full h-full kiosk-gradient flex items-center justify-center rounded-full">
              <span className="text-6xl md:text-7xl font-black text-primary-foreground">
                {BUSINESS.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight">
            ORDINA QUI
          </h1>
          <p className="mt-2 text-2xl md:text-3xl text-muted-foreground font-medium">
            Tocca per iniziare
          </p>
        </div>

        {/* Animated touch indicator */}
        <div className="mt-10 w-28 h-28 rounded-full border-4 border-primary/40 flex items-center justify-center animate-bounce">
          <div className="w-14 h-14 rounded-full kiosk-gradient" />
        </div>
      </div>

      {/* Bottom copyright */}
      <div className="absolute bottom-6 text-center">
        <p className="text-xs text-muted-foreground/50 font-medium tracking-wider">
          {BUSINESS.texts.welcomeFooter}
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;