import { useApp } from '@/hooks/useApp';
import { Shell } from '@/components/layout/Shell';
import { Toast } from '@/components/layout/Toast';
import { AuthView } from '@/features/auth/views/AuthView';

export default function App() {
  const v = useApp();
  return (
    <div data-theme={v.theme} className="flex h-screen w-full overflow-hidden bg-base text-fg text-[14px]">
      {v.authed ? <Shell v={v} /> : <AuthView v={v} />}
      <Toast v={v} />
    </div>
  );
}
