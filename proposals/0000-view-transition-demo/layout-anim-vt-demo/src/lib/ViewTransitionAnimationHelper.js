/**
 * Adapted from React Native's ViewTransition animation helper. It drives
 * ViewTransition animations by building a native Animated graph:
 *   - animateShare: FLIPs the "new" view from the old rect to the new rect.
 *   - animate: plays keyframes on an "old" or "new" pseudo element (enter/exit).
 */

import { LogBox, processColor } from 'react-native';
import { getFabricUIManager } from 'react-native/Libraries/ReactNative/FabricUIManager';
import NativeAnimatedHelper from 'react-native/src/private/animated/NativeAnimatedHelper';
import * as ReactNativeFeatureFlags from 'react-native/src/private/featureflags/ReactNativeFeatureFlags';
import NativeViewTransition from 'react-native/src/private/viewtransition/specs/NativeViewTransition';

const { API, generateNewAnimationId, generateNewNodeTag } = NativeAnimatedHelper;

// The private APIs above are only reachable through deep imports; keep their
// deprecation warning from covering the demo UI.
LogBox.ignoreLogs(["Deep imports from the 'react-native' package are deprecated"]);

function getViewTransitionInstance(element) {
  return (
    NativeViewTransition?.getViewTransitionInstance?.(
      element._name,
      element._pseudo
    ) ?? { x: 0, y: 0, width: 0, height: 0, nativeTag: -1 }
  );
}

// Normalize {from, to} / {'0%': ..., '100%': ...} keyframes into sorted stops.
function normalizeKeyframes(keyframes) {
  const stops = [];
  for (const key of Object.keys(keyframes)) {
    const offset =
      key === 'from' ? 0 : key === 'to' ? 1 : key.endsWith('%') ? parseFloat(key) / 100 : null;
    if (offset != null) {
      stops.push({ offset, properties: keyframes[key] });
    }
  }
  return stops.sort((a, b) => a.offset - b.offset);
}

function createInterpolation(driverTag, inputRange, outputRange, outputType, createdNodeTags) {
  const interpTag = generateNewNodeTag();
  API.createAnimatedNode(interpTag, {
    type: 'interpolation',
    inputRange,
    outputRange,
    outputType,
    extrapolateLeft: 'extend',
    extrapolateRight: 'extend',
  });
  API.connectAnimatedNodes(driverTag, interpTag);
  createdNodeTags.push(interpTag);
  return interpTag;
}

// Build a native Animated graph that plays `keyframes` (numeric/color style
// props and RN transform arrays) on `nativeInstance` over `duration` ms.
function animateKeyframes(nativeInstance, keyframes, duration, pseudo, restoreOnComplete) {
  const stops = normalizeKeyframes(keyframes);
  if (stops.length === 0) {
    return;
  }

  // Driver value node: animates 0 -> 1.
  const driverTag = generateNewNodeTag();
  API.createAnimatedNode(driverTag, { type: 'value', value: 0, offset: 0 });

  const createdNodeTags = [driverTag];
  const styleConfig = {};

  const props = new Set(stops.flatMap((stop) => Object.keys(stop.properties)));
  for (const prop of props) {
    if (prop === 'transform') {
      // One interpolation per transform entry, matched by position across stops.
      const transformStops = stops.filter((stop) => Array.isArray(stop.properties.transform));
      const entries = transformStops[0].properties.transform.flatMap((t) => Object.keys(t));
      const transforms = entries.map((property, i) => {
        const valueAt = (stop) =>
          stop.properties.transform.flatMap((t) => Object.values(t))[i] ?? 0;
        return {
          type: 'animated',
          property,
          nodeTag: createInterpolation(
            driverTag,
            transformStops.map((stop) => stop.offset),
            transformStops.map(valueAt),
            'number',
            createdNodeTags
          ),
        };
      });
      const transformTag = generateNewNodeTag();
      API.createAnimatedNode(transformTag, { type: 'transform', transforms });
      for (const t of transforms) {
        API.connectAnimatedNodes(t.nodeTag, transformTag);
      }
      createdNodeTags.push(transformTag);
      styleConfig.transform = transformTag;
    } else {
      const propStops = stops.filter((stop) => stop.properties[prop] != null);
      const isColor = typeof propStops[0].properties[prop] === 'string';
      styleConfig[prop] = createInterpolation(
        driverTag,
        propStops.map((stop) => stop.offset),
        propStops.map((stop) =>
          isColor ? processColor(stop.properties[prop]) : stop.properties[prop]
        ),
        isColor ? 'color' : 'number',
        createdNodeTags
      );
    }
  }

  // Style node -> props node -> view.
  const styleTag = generateNewNodeTag();
  API.createAnimatedNode(styleTag, { type: 'style', style: styleConfig });
  for (const childTag of Object.values(styleConfig)) {
    API.connectAnimatedNodes(childTag, styleTag);
  }
  createdNodeTags.push(styleTag);

  const propsTag = generateNewNodeTag();
  API.createAnimatedNode(propsTag, { type: 'props', props: { style: styleTag } });
  API.connectAnimatedNodes(styleTag, propsTag);
  createdNodeTags.push(propsTag);

  API.connectAnimatedNodeToView(propsTag, nativeInstance.nativeTag);

  if (ReactNativeFeatureFlags.useSharedAnimatedBackend()) {
    // The "old" pseudo element is a Fabric-only shadow node (no React fiber),
    // so it can't be found through the regular UIManager lookup.
    const shadowNode =
      pseudo === 'old'
        ? NativeViewTransition?.findPseudoElementShadowNodeByTag?.(nativeInstance.nativeTag)
        : getFabricUIManager()?.findShadowNodeByTag_DEPRECATED?.(nativeInstance.nativeTag);
    if (shadowNode != null) {
      API.connectAnimatedNodeToShadowNodeFamily(propsTag, shadowNode);
    } else {
      console.error(
        'ShadowNode is not available for',
        pseudo,
        'pseudo element at tag',
        nativeInstance.nativeTag
      );
    }
  }

  // 60fps linear frames.
  const numFrames = Math.max(Math.round((Number(duration) / 1000) * 60), 1);
  const frames = [];
  for (let i = 0; i <= numFrames; i++) {
    frames.push(i / numFrames);
  }

  const animationId = generateNewAnimationId();
  // Keep the view transition open until this animation finishes.
  NativeViewTransition?.waitForTransitionAnimation?.(animationId);

  API.setAnimatedNodeValue(driverTag, 0);
  API.startAnimatingNode(
    animationId,
    driverTag,
    { type: 'frames', frames, toValue: 1, iterations: 1, deferredStart: true },
    () => {
      API.stopAnimation(animationId);
      NativeViewTransition?.transitionAnimationFinished?.(animationId);
      if (restoreOnComplete) {
        API.restoreDefaultValues(propsTag);
      }
      // Disconnect before dropping: the props node must still exist to disconnect.
      API.disconnectAnimatedNodeFromView(propsTag, nativeInstance.nativeTag);
      for (let i = createdNodeTags.length - 1; i >= 0; i--) {
        API.dropAnimatedNode(createdNodeTags[i]);
      }
    }
  );
}

/**
 * Play keyframes on a pseudo element, e.g. `instance.new` in onEnter or
 * `instance.old` in onExit:
 *   animate(instance.old, {
 *     animationDuration: 300,
 *     animation: {keyframes: {from: {opacity: 1}, to: {opacity: 0}}},
 *   });
 */
export function animate(pseudoElement, options) {
  const keyframes = options?.animation?.keyframes;
  if (keyframes == null) {
    return;
  }
  animateKeyframes(
    getViewTransitionInstance(pseudoElement),
    keyframes,
    options?.animationDuration ?? 300,
    pseudoElement._pseudo,
    false
  );
}

/**
 * Animate a shared element transition: measure instance.old and instance.new,
 * then tween instance.new's layout (left/top/width/height) from the old rect to
 * the new rect.
 */
export function animateShare(instance, options) {
  if (instance == null) {
    return;
  }

  const oldInstance = getViewTransitionInstance(instance.old);
  const newInstance = getViewTransitionInstance(instance.new);

  if (
    newInstance.nativeTag === -1 ||
    (oldInstance.nativeTag === -1 &&
      oldInstance.width === 0 &&
      oldInstance.height === 0 &&
      oldInstance.x === 0 &&
      oldInstance.y === 0)
  ) {
    console.warn(
      'ViewTransition instance is not available for viewTransitionName',
      instance.name,
      '- old tag',
      oldInstance.nativeTag,
      'new tag',
      newInstance.nativeTag
    );
    return;
  }

  animateKeyframes(
    newInstance,
    {
      from: {
        left: oldInstance.x - newInstance.x,
        top: oldInstance.y - newInstance.y,
        width: oldInstance.width,
        height: oldInstance.height,
      },
      to: { left: 0, top: 0, width: newInstance.width, height: newInstance.height },
    },
    options?.animationDuration ?? 300,
    'new',
    true
  );
}
