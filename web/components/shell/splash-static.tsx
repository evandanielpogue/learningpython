import { Mark } from '@/components/brand/mark';

/* What shows for the instant before the workspace loads. */
export function SplashStatic() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <Mark size={44} className="animate-float" />
    </div>
  );
}
