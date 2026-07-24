import type { ReactNode } from 'react';
import { Logo } from '@/components/ui';

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full h-screen overflow-hidden bg-base">
      <div className="flex-1 min-w-0 flex items-center justify-center p-8">
        <div className="w-[400px] max-w-full bg-surface border border-line rounded-14 p-8 shadow-auth">
          <div className="flex items-center gap-2.5 mb-7">
            <Logo size={28} />
            <span className="font-semibold text-[16px]">ghfinder</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-10 flex items-center justify-center gap-2.5 bg-surface border border-line rounded-9 text-fg font-medium text-[13.5px] cursor-pointer hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="w-4 h-4 rounded-full" style={{ background: 'conic-gradient(from -45deg,#EA4335,#FBBC05,#34A853,#4285F4,#EA4335)' }} />
      {label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-[18px]">
      <span className="flex-1 h-px bg-line" />
      <span className="text-muted text-[11px]">OR</span>
      <span className="flex-1 h-px bg-line" />
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h2 className="text-[22px] font-bold tracking-[-0.02em] mb-1.5">{title}</h2>
      {subtitle && <p className="text-muted text-[13.5px] mb-[22px]">{subtitle}</p>}
    </>
  );
}
