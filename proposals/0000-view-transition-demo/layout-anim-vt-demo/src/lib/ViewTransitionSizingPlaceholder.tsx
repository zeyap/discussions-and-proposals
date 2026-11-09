import { type ComponentRef, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';

/**
 * `animateShare` tweens layout props (left/top/width/height), so the
 * transitioning view stays in the layout flow and would push its neighbors
 * around. This wrapper pins its size to the children's measured size so the
 * surrounding layout stays stable during the transition.
 *
 * Don't wrap a conditionally rendered <ViewTransition> with it: the wrapper is
 * always present, so React never sees that ViewTransition enter or exit.
 */
export function ViewTransitionSizingPlaceholder({ children }: { children?: ReactNode }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const ref = useRef<ComponentRef<typeof View>>(null);

  useLayoutEffect(() => {
    // Layout effects run before ViewTransition event handlers.
    if (size == null) {
      const rect = ref.current?.getBoundingClientRect();
      if (rect && !(rect.width === 0 && rect.height === 0)) {
        setSize({ width: rect.width, height: rect.height });
      }
    }
  }, [size]);

  return (
    // collapsableChildren={false} keeps the animated child from being flattened.
    <View collapsableChildren={false} ref={ref} style={size ?? undefined}>
      {children}
    </View>
  );
}
