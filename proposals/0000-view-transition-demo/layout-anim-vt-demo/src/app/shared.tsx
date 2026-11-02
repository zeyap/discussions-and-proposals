// Shared element transition: tapping a card in the list moves it into the
// detail header, while the other cards exit away from it. "Back" reverses it.
import * as React from 'react';
import { startTransition, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { animate, animateShare } from '@/lib/ViewTransitionAnimationHelper';
import { ViewTransitionSizingPlaceholder } from '@/lib/ViewTransitionSizingPlaceholder';

// `ViewTransition` is exported by our patched `react` (canary) build.
const ViewTransition: any = (React as any).ViewTransition;

type Item = { id: string; label: string; color: string };

const ITEMS: Item[] = Array.from({ length: 10 }, (_, i) => ({
  id: `item-${i}`,
  label: `Item ${i}`,
  color: `hsl(${(i * 37) % 360}, 70%, 80%)`,
}));

function DetailView({ item, onBack }: { item: Item; onBack: () => void }) {
  const colors = useTheme();
  return (
    <>
      <ViewTransitionSizingPlaceholder>
        <ViewTransition
          name={`card-${item.id}`}
          onShare={(instance: any) => animateShare(instance, { animationDuration: 300 })}>
          <View style={{ height: 300 }}>
            <View
              style={{
                height: '100%',
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: item.color,
              }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333' }}>
                {item.label}
              </Text>
            </View>
          </View>
        </ViewTransition>
      </ViewTransitionSizingPlaceholder>
      <Pressable
        onPress={onBack}
        style={{
          marginTop: 20,
          padding: 12,
          backgroundColor: colors.text,
          borderRadius: 8,
          alignItems: 'center',
        }}>
        <Text style={{ color: colors.background }}>Back</Text>
      </Pressable>
    </>
  );
}

export default function SharedElementScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Item | null>(null);
  // Read in onExit to send cards above the tapped one up and the rest down.
  const selectedIndexRef = useRef(0);

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
      }}>
      {/* The ScrollView stays mounted across both states, so each card's
          <ViewTransition> is the top of what gets removed. Exit only fires for
          a ViewTransition with no host view above it in the removed subtree,
          which is why this isn't a FlatList (its cell views would sit above). */}
      <ScrollView>
        {selected != null ? (
          <DetailView item={selected} onBack={() => startTransition(() => setSelected(null))} />
        ) : (
          ITEMS.map((item, index) => (
            <ViewTransition
              key={item.id}
              name={`card-${item.id}`}
              onShare={(instance: any) => animateShare(instance, { animationDuration: 300 })}
              onExit={(instance: any) =>
                animate(instance.old, {
                  animationDuration: 300,
                  animation: {
                    keyframes: {
                      from: { opacity: 1, transform: [{ translateY: 0 }] },
                      to: {
                        opacity: 0,
                        transform: [
                          { translateY: index < selectedIndexRef.current ? -200 : 200 },
                        ],
                      },
                    },
                  },
                })
              }>
              <Pressable
                onPress={() => {
                  selectedIndexRef.current = index;
                  startTransition(() => setSelected(item));
                }}
                style={{ marginVertical: 6, height: 100, zIndex: 1 }}>
                <View
                  style={{
                    height: '100%',
                    padding: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: item.color,
                  }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            </ViewTransition>
          ))
        )}
      </ScrollView>
    </View>
  );
}
