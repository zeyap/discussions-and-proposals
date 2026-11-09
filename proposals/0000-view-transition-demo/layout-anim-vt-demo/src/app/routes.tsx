// Route cross-fade with <Activity>: hiding a route is an exit, revealing one is
// an enter, so routes keep their state and still animate. The switch turns the
// animation off to compare against an instant swap.
import * as React from 'react';
import { Activity, startTransition, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { animate } from '@/lib/ViewTransitionAnimationHelper';

// `ViewTransition` is exported by our patched `react` (canary) build.
const ViewTransition: any = (React as any).ViewTransition;

const ROUTES = [
  { id: 'home', title: 'Home', color: '#4A90D9', content: 'Tap a tab below to cross-fade.' },
  { id: 'explore', title: 'Explore', color: '#7B61FF', content: 'Discover new content here.' },
  { id: 'profile', title: 'Profile', color: '#E07C4F', content: 'View your profile details.' },
];

export default function RoutesScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRouteId, setActiveRouteId] = useState('home');
  const [animated, setAnimated] = useState(true);

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
          Animated transition
        </Text>
        <Switch value={animated} onValueChange={setAnimated} />
      </View>
      {ROUTES.map((route) => (
        <Activity key={route.id} mode={route.id === activeRouteId ? 'visible' : 'hidden'}>
          <ViewTransition
            name={`route-${route.id}`}
            onExit={
              animated
                ? (instance: any) =>
                    animate(instance.old, {
                      animationDuration: 600,
                      animation: {
                        keyframes: {
                          from: { opacity: 1 },
                          to: { opacity: 0 },
                        },
                      },
                    })
                : undefined
            }
            onEnter={
              animated
                ? (instance: any) =>
                    animate(instance.new, {
                      animationDuration: 600,
                      animation: {
                        keyframes: { from: { left: 100 }, to: { left: 0 } },
                      },
                    })
                : undefined
            }>
            <View
              style={{
                flex: 1,
                minHeight: 300,
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: route.color,
              }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 12 }}>
                {route.title}
              </Text>
              <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)' }}>
                {route.content}
              </Text>
            </View>
          </ViewTransition>
        </Activity>
      ))}
      <View
        style={{
          flexDirection: 'row',
          marginVertical: 16,
          borderRadius: 12,
          backgroundColor: colors.backgroundElement,
          padding: 4,
        }}>
        {ROUTES.map((route) => (
          <Pressable
            key={route.id}
            onPress={() => {
              if (route.id !== activeRouteId) {
                startTransition(() => setActiveRouteId(route.id));
              }
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderRadius: 10,
              backgroundColor: route.id === activeRouteId ? colors.background : undefined,
            }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
              {route.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
