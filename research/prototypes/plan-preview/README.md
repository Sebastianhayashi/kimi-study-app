# Read-only course plan preview

This disposable prototype implements P1-08 outside `public/`, `lib/`, and `server.js`. It renders a fixed copy of an existing source-digest and Teach Mission shape. It does not call an API, start generation, write course data, or persist edits.

Open `research/prototypes/plan-preview/prototype.html` directly, or serve the repository root with a static file server and open the same path. The existing Lucubro server intentionally does not expose this prototype as a production route.

## Decision boundary

The prototype only tests whether a learner can notice a mismatch before full generation. It is not approval for P2-10, persistent plan state, or server changes.
