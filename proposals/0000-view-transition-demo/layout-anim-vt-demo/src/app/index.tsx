// Four layout-animation examples on one screen, all animating the same demo:
// a flex-wrap container (parent A) shrinks and its 6 children reflow.
//
//   1   · React ViewTransition — commits the NEW layout,
//         measures each element before/after, and FLIPs it from old rect to new
//         rect, so the persistent children actually reflow automatically.
//   2-4 · Reanimated — layout animations are INDEPENDENT
//         and LIMITED: they interpolate a view's own frame and don't re-run
//         flexbox, so wrapped children snap instead of gliding (except #3, which
//         sidesteps layout animation by tweening hand-computed final sizes).
import * as React from 'react';
import {
  type ComponentRef,
  startTransition,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { animateShare } from '@/lib/ViewTransitionAnimationHelper';

// `ViewTransition` is exported by our patched `react` (canary) build; the shipped
// @types/react doesn't declare it, so read it dynamically and type it loosely.
const ViewTransition: any = (React as any).ViewTransition;

const CHILD_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const PARENT_LARGE = 320;
const PARENT_SMALL = 176;

const PARENT_BASE_STYLE = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 12,
  padding: 12,
  borderRadius: 20,
} as const;

function ChildRects() {
  return (
    <>
      {CHILD_COLORS.map((color, i) => (
        <View
          key={i}
          style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: color }}
        />
      ))}
    </>
  );
}

function ToggleButton({
  shrunk,
  onPress,
}: {
  shrunk: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shrunk ? 'Grow rectangle A' : 'Shrink rectangle A'}
      onPress={onPress}
      style={{
        backgroundColor: colors.text,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 999,
      }}>
      <Text
        style={{
          color: colors.background,
          fontSize: 17,
          fontWeight: '600',
          fontFamily: Fonts?.rounded,
        }}>
        {shrunk ? 'Grow A' : 'Shrink A'}
      </Text>
    </Pressable>
  );
}

function ExampleTitle({ children }: { children: string }) {
  const colors = useTheme();
  return (
    <Text
      accessibilityLabel={children}
      style={{
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: Fonts?.rounded,
        color: colors.text,
        textAlign: 'center',
      }}>
      {children}
    </Text>
  );
}

// 1 · React ViewTransition: commits the new layout, then FLIPs each element from
// its old rect to its new rect via animateShare — children reflow automatically.
function ViewTransitionExample() {
  const colors = useTheme();
  const [shrunk, setShrunk] = useState(false);

  const REFLOW_DURATION = 400;

  const reflow = (instance: any) => {
    if (instance) {
      animateShare(instance, { animationDuration: REFLOW_DURATION });
    }
  };

  const toggle = () => {
    // The state change must run in a transition for ViewTransition to fire.
    startTransition(() => {
      setShrunk((v) => !v);
    });
  };

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <ExampleTitle>
        {'1 · ViewTransition on container \n✅ children reflow automatically'}
      </ExampleTitle>
      <ViewTransition name="parent-a" onUpdate={reflow}>
        <View
          // force parent container re-render so ViewTransition captures a new commit
          key={'parent-a ' + (shrunk ? 'shrunk' : 'large')}
          style={{
            ...PARENT_BASE_STYLE,
            width: shrunk ? PARENT_SMALL : PARENT_LARGE,
            backgroundColor: colors.textSecondary,
          }}>
          {CHILD_COLORS.map((color, i) => (
            <View
              key={`child_${i}`}
              style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: color }}
            />
          ))}
        </View>
      </ViewTransition>
      <ToggleButton shrunk={shrunk} onPress={toggle} />
    </View>
  );
}

// 2 · Reanimated layout animation (LinearTransition): A's box tweens, but
// LinearTransition only interpolates A's own frame — children jump across wrap
// boundaries.
function LayoutAnimationExample() {
  const colors = useTheme();
  const [shrunk, setShrunk] = useState(false);
  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <ExampleTitle>
        {'2 · Reanimated layout animation on container - end height unset \n❌ children don’t reflow correctly'}
      </ExampleTitle>
      <Animated.View
        layout={LinearTransition}
        style={{
          ...PARENT_BASE_STYLE,
          width: shrunk ? PARENT_SMALL : PARENT_LARGE,
          backgroundColor: colors.textSecondary,
        }}>
        <ChildRects />
      </Animated.View>
      <ToggleButton shrunk={shrunk} onPress={() => setShrunk((v) => !v)} />
    </View>
  );
}

// 3 · Reanimated hardcoded width/height: Yoga gets the final width immediately
// (children wrap at once) and the box gets an exact final height, so this one
// reflows "correctly" — at the cost of hand-computed magic-number heights.
function HardcodedSizeExample() {
  const colors = useTheme();
  const [shrunk, setShrunk] = useState(false);

  // Exact final heights, hand-computed to match the wrapped content at each width:
  //   large: 320 wide → inner 296 → 3 columns → 2 rows → 2×80 + 12 + 24 = 196
  //   small: 176 wide → inner 152 → 1 column  → 6 rows → 6×80 + 5×12 + 24 = 564
  const EX3_HEIGHT_LARGE = 196;
  const EX3_HEIGHT_SMALL = 564;

  const width = useSharedValue(PARENT_LARGE);
  const height = useSharedValue(EX3_HEIGHT_LARGE);

  const sizeStyle = useAnimatedStyle(() => ({
    width: withTiming(width.value),
    height: withTiming(height.value),
  }));

  const toggle = () => {
    setShrunk((prev) => {
      const next = !prev;
      width.value = next ? PARENT_SMALL : PARENT_LARGE;
      height.value = next ? EX3_HEIGHT_SMALL : EX3_HEIGHT_LARGE;
      return next;
    });
  };

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <ExampleTitle>
        {'3 · Reanimated layout animation on container - hardcoded end height\n✅ children reflow correct'}
      </ExampleTitle>
      <Animated.View
        style={[PARENT_BASE_STYLE, { backgroundColor: colors.textSecondary }, sizeStyle]}>
        <ChildRects />
      </Animated.View>
      <ToggleButton shrunk={shrunk} onPress={toggle} />
    </View>
  );
}

// 4 · Reanimated measured width/height (end height measured in a layout effect):
// width animated on the UI thread never goes through a React layout commit, so
// there's no per-frame flexbox pass — children don't reflow.
function AnimatedSizeExample() {
  const colors = useTheme();
  const [shrunk, setShrunk] = useState(false);
  const targetWidth = shrunk ? PARENT_SMALL : PARENT_LARGE;

  const contentRef = useRef<ComponentRef<typeof View>>(null);
  const width = useSharedValue(PARENT_LARGE);
  const height = useSharedValue(0);

  const sizeStyle = useAnimatedStyle(() => ({
    width: withTiming(width.value),
    height: height.value === 0 ? undefined : withTiming(height.value),
  }));

  useLayoutEffect(() => {
    contentRef.current?.measure((_x, _y, _w, measuredHeight) => {
      height.value = measuredHeight;
    });
  }, [targetWidth, height]);

  const toggle = () => {
    setShrunk((prev) => {
      const next = !prev;
      width.value = next ? PARENT_SMALL : PARENT_LARGE;
      return next;
    });
  };

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <ExampleTitle>
        {'4 · Reanimated layout animation on container - end height measured in layoutEffect \n❌ children don’t reflow correctly'}
      </ExampleTitle>
      <Animated.View
        style={[{ backgroundColor: colors.textSecondary, borderRadius: 20 }, sizeStyle]}>
        <View ref={contentRef} style={{ ...PARENT_BASE_STYLE, width: targetWidth }}>
          <ChildRects />
        </View>
      </Animated.View>
      <ToggleButton shrunk={shrunk} onPress={toggle} />
    </View>
  );
}

export default function HomeScreen() {
  const colors = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        alignItems: 'center',
        gap: 48,
        paddingVertical: 64,
        paddingHorizontal: 32,
      }}>
      <ViewTransitionExample />
      <LayoutAnimationExample />
      <HardcodedSizeExample />
      <AnimatedSizeExample />
    </ScrollView>
  );
}
