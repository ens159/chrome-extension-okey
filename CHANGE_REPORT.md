# Change Report

## Files Modified

1. **manifest.json** – added `icons` field pointing to `icons/icon.svg`.
2. **settings.js** – added defensive null‑checks before writing to `#saves` and `#played` containers to avoid `TypeError` when elements are missing.

## Summary of Changes
- **manifest.json** (lines 9‑13):
```diff
+  "icons": {
+    "128": "icons/icon.svg"
+  }
```
- **settings.js** (lines ~30‑35 and ~36‑40):
```diff
+const savesContainer = $('saves');
+if (savesContainer) {
+  savesContainer.innerHTML = ...
+}
+
+const playedContainer = $('played');
+if (playedContainer) {
+  playedContainer.innerHTML = ...
+}
```

These changes improve the extension’s branding and prevent UI crashes.
