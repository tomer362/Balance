import { useEffect, useState, type ReactNode } from 'react';

interface BottomSheetProps {
  children: ReactNode;
  onClose: () => void;
}

/**
 * iOS-safe bottom sheet.
 *
 * Chrome iOS does NOT shrink the layout viewport when the software keyboard
 * opens, so `position: fixed; bottom: 0` sheets end up hidden behind the
 * keyboard.  `window.visualViewport` *does* shrink, so we track the delta
 * and push the sheet up by exactly that amount.
 */
export default function BottomSheet({ children, onClose }: BottomSheetProps) {
  const [kbOffset, setKbOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      // keyboard height ≈ layout viewport height − (visual viewport height + scroll offset)
      const offset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
      setKbOffset(offset);
    }

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        data-testid="bottomsheet-backdrop"
      />
      {/* Sheet */}
      <div
        className="fixed left-0 right-0 z-50 mx-auto max-w-md bg-cream-bg rounded-t-3xl"
        style={{ bottom: kbOffset }}
        data-testid="bottomsheet"
      >
        {children}
      </div>
    </>
  );
}
