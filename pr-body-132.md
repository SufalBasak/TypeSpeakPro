## Description
Fixes #132

This PR addresses the race condition where timers and event listeners in the TypingTest component continue running after the component unmounts, causing React state updates on unmounted components.

## Changes Made

### 1. Cleanup `setTimeout` in initialization `useEffect`
- The timeout that opens the multiplayer modal after a 100ms delay was never cleared on unmount
- Added `clearTimeout` in the cleanup function of the `useEffect`

### 2. Cancel `requestAnimationFrame` in `useLayoutEffect`
- The auto-scroll logic used `requestAnimationFrame` without cancellation on unmount
- Added `cancelAnimationFrame` in the cleanup function

### 3. Added `isCancelledRef` mount guard
- Added a `useRef<boolean>` flag that is set to `true` on unmount
- Added early-return checks in `handleComplete` and throughout the async `endTest` function
- Prevents Supabase API callbacks and state updates from executing after unmount

## Impact
- Eliminates React warning: "Can't perform a React state update on an unmounted component"
- Prevents memory leaks from uncleared timers and animation frames
- No breaking changes to existing functionality
