# README media ownership

The README media owner is the maintainer who changes the corresponding product surface. A UI pull request must declare whether it changes any image slot in `manifest.json`.

Capture with:

```bash
node scripts/capture-readme-media.js
node scripts/verify-readme-media.js
```

Each locale uses the same fixture, route, viewport, theme, and stable condition. The capture command rebuilds isolated data under `tests/.runtime`, projects the fixture content into the requested locale, and captures with reduced motion so the evidence does not depend on animation timing. Review the three locale directories together. Do not add hand-painted UI copy, private course data, raw temporary PNG files, or a media dependency.

The pull request description must link the capture command, byte-budget result, tested browser, and before/after evidence. A release owner checks that the repository social preview and README promise still match the product.
