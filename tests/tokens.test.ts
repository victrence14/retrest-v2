import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  flatten,
  generateCss,
  resolve,
} from "../design-tokens/scripts/build.mjs";

test("all theme aliases resolve and the generated CSS matches Tokens Studio source", () => {
  const tokens = JSON.parse(
    readFileSync(
      new URL("../design-tokens/tokens.json", import.meta.url),
      "utf8",
    ),
  );
  const css = generateCss(tokens);
  assert.equal(
    css,
    readFileSync(
      new URL("../design-tokens/generated/theme.css", import.meta.url),
      "utf8",
    ).replace(/\r\n/g, "\n"),
  );
  const dark = { ...flatten(tokens.global), ...flatten(tokens.dark) };
  assert.equal(resolve("{color.focus}", dark), resolve("{color.accent}", dark));
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /--font-size-workspace-display: clamp\(32px, 5vw, 64px\)/);
});

test("both sites use defined shared tokens without component color literals", () => {
  const generated = readFileSync(new URL("../design-tokens/generated/theme.css", import.meta.url), "utf8");
  const defined = new Set([...generated.matchAll(/(--[\w-]+):/g)].map((match) => match[1]));
  for (const path of ["design-tokens/src/base.css", "frontend/src/styles.css", "landing-page/src/styles.css"]) {
    const css = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i, `${path} must use semantic colors`);
    for (const [, name] of css.matchAll(/var\((--[\w-]+)/g)) {
      assert.ok(defined.has(name), `${path} references an undefined token: ${name}`);
    }
  }
  const tokens = JSON.parse(readFileSync(new URL("../design-tokens/tokens.json", import.meta.url), "utf8"));
  const light = { ...flatten(tokens.global), ...flatten(tokens.light) };
  const manifest = JSON.parse(readFileSync(new URL("../frontend/public/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.theme_color, resolve("{color.accent}", light));
  assert.equal(manifest.background_color, resolve("{color.background}", light));
  for (const site of ["frontend", "landing-page"]) {
    const icon = readFileSync(new URL(`../${site}/public/favicon.svg`, import.meta.url), "utf8");
    assert.ok(icon.includes(resolve("{color.accent}", light)));
    assert.ok(icon.includes(resolve("{color.highlight}", light)));
  }
});

function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/.{2}/g)!.map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

test("semantic text, status, button and badge colors remain readable in both themes", () => {
  const tokens = JSON.parse(readFileSync(new URL("../design-tokens/tokens.json", import.meta.url), "utf8"));
  for (const theme of ["light", "dark"]) {
    const values = { ...flatten(tokens.global), ...flatten(tokens[theme]) };
    const pairs = [
      ...["background", "surface", "surfaceRaised"].flatMap((surface) =>
        ["text", "muted", "accent", "error", "success"].map((text) => [text, surface]),
      ),
      ["onAccent", "accent"], ["onAccent", "accentHover"], ["onHighlight", "highlight"],
    ];
    for (const [text, surface] of pairs) {
      const a = luminance(resolve(`{color.${text}}`, values));
      const b = luminance(resolve(`{color.${surface}}`, values));
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(contrast >= 4.5, `${theme} ${text} on ${surface}: ${contrast.toFixed(2)}:1`);
    }
  }
});

test("invalid aliases and divergent themes fail before shipping broken CSS", () => {
  assert.throws(() => resolve("{missing}", {}), /Unknown token/);
  assert.throws(() => resolve("{a}", { a: "{b}", b: "{a}" }), /Circular token/);
  assert.throws(
    () => generateCss({ global: {}, light: { a: { value: "red" } }, dark: {} }),
    /same tokens/,
  );
});
