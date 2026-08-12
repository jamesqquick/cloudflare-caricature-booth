# Capture Mute Toggle Design

## Goal

Add an accessible mute control to the selfie capture page. The preference applies to every event on the current browser or kiosk device and remains in effect until someone changes it.

## Interface

Replace the empty spacer at the right side of the capture header with a circular speaker icon button. The button starts in the persisted state and updates all of the following whenever it is toggled:

- The visible sound-on or muted icon.
- The accessible label, using `Mute sounds` while sound is enabled and `Unmute sounds` while muted.
- `aria-pressed`, where `true` means the mute setting is active.

The button remains available while taking and reviewing a photo. It does not replace or intercept the shutter button gesture used to unlock audio on Safari and iPad.

## State And Persistence

Use a page-level `isMuted` boolean and persist it under the device-wide `localStorage` key `kiosk:capture-muted`.

- Missing values default to sound enabled.
- Only the exact stored value `true` enables mute.
- Reads and writes are wrapped so unavailable or restricted storage cannot break the capture flow.
- Retakes retain the current page state, while reloads and other events restore the device-wide preference.

## Audio Behavior

Keep the existing shared `AudioContext`. Both `playBeep()` and `playShutterSound()` return immediately when muted or when the audio context is unavailable. Unmuting restores both sounds without recreating the context.

Camera access, countdown visuals, shutter flash, frame capture, retakes, and upload behavior remain unchanged.

## Verification

Verify the generated capture page includes the default accessible state, both icon states, persistence logic, and mute guards. Run the TypeScript compiler and production CSS build. Manually exercise the capture page when browser access is available, including muted capture, unmuted capture, retake persistence, reload persistence, and operation without `AudioContext` or writable `localStorage`.
