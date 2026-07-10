/**
 * Adapted from React Native's ViewTransition animation helper — it FLIPs the "new" view from the old
 * rect to the new rect by building a native Animated graph.
 */

import { getFabricUIManager } from 'react-native/Libraries/ReactNative/FabricUIManager';
import NativeAnimatedHelper from 'react-native/src/private/animated/NativeAnimatedHelper';
import * as ReactNativeFeatureFlags from 'react-native/src/private/featureflags/ReactNativeFeatureFlags';
import NativeViewTransition from 'react-native/src/private/viewtransition/specs/NativeViewTransition';

const { API, generateNewAnimationId, generateNewNodeTag } = NativeAnimatedHelper;

function getViewTransitionInstance(element) {
  return (
    NativeViewTransition?.getViewTransitionInstance?.(
      element._name,
      element._pseudo
    ) ?? { x: 0, y: 0, width: 0, height: 0, nativeTag: -1 }
  );
}

// Build a native Animated graph that tweens the given numeric style props of
// `nativeInstance` from their `from` values to their `to` values over `duration` ms.
function animateLayout(nativeInstance, from, to, duration) {
  const props = Object.keys(to);
  if (props.length === 0) {
    return;
  }

  // Driver value node: animates 0 -> 1.
  const driverTag = generateNewNodeTag();
  API.createAnimatedNode(driverTag, { type: 'value', value: 0, offset: 0 });

  const createdNodeTags = [driverTag];
  const styleConfig = {};

  // One interpolation node per prop, driven by the value node.
  for (const prop of props) {
    const interpTag = generateNewNodeTag();
    API.createAnimatedNode(interpTag, {
      type: 'interpolation',
      inputRange: [0, 1],
      outputRange: [from[prop], to[prop]],
      outputType: 'number',
      extrapolateLeft: 'extend',
      extrapolateRight: 'extend',
    });
    API.connectAnimatedNodes(driverTag, interpTag);
    createdNodeTags.push(interpTag);
    styleConfig[prop] = interpTag;
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
    const shadowNode = getFabricUIManager()?.findShadowNodeByTag_DEPRECATED?.(
      nativeInstance.nativeTag
    );
    if (shadowNode != null) {
      API.connectAnimatedNodeToShadowNodeFamily(propsTag, shadowNode);
    } else {
      console.error(
        'ShadowNode is not available for pseudo element at tag',
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
  NativeViewTransition?.waitForTransitionAnimation?.(animationId);

  API.setAnimatedNodeValue(driverTag, 0);
  API.startAnimatingNode(
    animationId,
    driverTag,
    { type: 'frames', frames, toValue: 1, iterations: 1, deferredStart: true },
    () => {
      API.stopAnimation(animationId);
      NativeViewTransition?.transitionAnimationFinished?.(animationId);
      API.restoreDefaultValues(propsTag);
      for (let i = createdNodeTags.length - 1; i >= 0; i--) {
        API.dropAnimatedNode(createdNodeTags[i]);
      }
      API.disconnectAnimatedNodeFromView(propsTag, nativeInstance.nativeTag);
    }
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

  const duration = options?.animationDuration ?? 300;

  animateLayout(
    newInstance,
    {
      left: oldInstance.x - newInstance.x,
      top: oldInstance.y - newInstance.y,
      width: oldInstance.width,
      height: oldInstance.height,
    },
    { left: 0, top: 0, width: newInstance.width, height: newInstance.height },
    duration
  );
}
