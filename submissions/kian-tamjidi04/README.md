# Whackschach

**By:** Kian Tamjidi

**Pitch:** Every whack() call becomes a Rorschach inkblot, steered letter by letter by ASCII codes.

## How to run it

```
bun server.ts
```

Then open http://localhost:3000. Each click on **Call whack()** calls the real `whack()` and shows the `whack` file it wrote as the patient's transcript. Set `ANTHROPIC_API_KEY` if you want Claude to read the blot from the image alone. Without it, a built-in stand-in examiner does the reading.

## How the blot is drawn

- A turtle pen walks the words. Before each word the heading swings by the word's ASCII sum mod 360. Each letter then turns the pen (code − 109.5) × 6° and steps it 6 + 2 × (code mod 7), with stroke weight 2 + (code mod 5).
- Each word ends in an ink splat with radius 3 + length × 2.2, inked in its category's colour: event, sponsor, bird, bug, git or life.
- The path is fitted into the left half with its right edge on the fold, then mirrored. Ink thins as the call grows, so 100 words come out intricate rather than solid.

## Screenshot

![screenshot](screenshot.png)
