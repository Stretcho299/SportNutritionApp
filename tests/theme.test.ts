import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path: string) =>
  readFileSync(join(projectRoot, path), "utf8");
const appCss = readSource("src/App.css");
const indexCss = readSource("src/index.css");
const entrySource = readSource("src/main.tsx");
const redesignCss = readSource("src/redesign-v2.css");
const themeCss = readSource("src/theme.css");
const componentCss = [indexCss, appCss, redesignCss];
const themeTokens = [...themeCss.matchAll(/^\s*(--[\w-]+):/gm)].map(
  (match) => match[1],
);

function tokenDefinition(token: string) {
  return themeCss.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1].trim();
}

function tokenValue(token: string, seen: string[] = []): string | undefined {
  if (seen.includes(token)) return undefined;
  const value = tokenDefinition(token);
  const alias = value?.match(/^var\((--[\w-]+)\)$/);
  return alias ? tokenValue(alias[1], [...seen, token]) : value;
}

function isOrangeAccent(hex: string) {
  let digits = hex.slice(1);
  if (digits.length === 3 || digits.length === 4)
    digits = [...digits.slice(0, 3)].map((part) => part + part).join("");
  if (digits.length !== 6 && digits.length !== 8) return false;

  const [red, green, blue] = [0, 2, 4].map(
    (index) => Number.parseInt(digits.slice(index, index + 2), 16) / 255,
  );
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return false;

  let hue: number;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  hue = (((hue * 60) % 360) + 360) % 360;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  return hue >= 8 && hue <= 42 && saturation > 0.45 && lightness > 0.28;
}

describe("semantic theme token contract", () => {
  it("keeps the shared palette in one source imported before component styles", () => {
    const required = [
      "--background",
      "--surface",
      "--surface-raised",
      "--surface-inset",
      "--line",
      "--text",
      "--muted",
      "--accent",
      "--accent-soft",
      "--accent-ink",
      "--success",
      "--danger",
      "--danger-soft",
      "--danger-border",
    ];

    expect(new Set(themeTokens).size).toBe(themeTokens.length);
    for (const token of [...required, ...themeTokens]) {
      expect(themeCss.match(new RegExp(`${token}:`, "g"))).toHaveLength(1);
      for (const css of componentCss)
        expect(css).not.toMatch(new RegExp(`${token}\\s*:`));
    }

    const themeImport = entrySource.indexOf('import "./theme.css";');
    const baseImport = entrySource.indexOf('import "./index.css";');
    const appImport = entrySource.indexOf('import App from "./App";');
    expect(themeImport).toBeGreaterThanOrEqual(0);
    expect(entrySource.match(/import "\.\/theme\.css";/g)).toHaveLength(1);
    expect(themeImport).toBeLessThan(baseImport);
    expect(baseImport).toBeLessThan(appImport);
  });

  it("keeps danger and success independent from the accent", () => {
    expect(tokenValue("--danger")).toBe("#ff5258");
    expect(tokenValue("--danger-soft")).toBe("#351719");
    expect(tokenValue("--danger-border")).toBe("#8c3035");
    expect(tokenValue("--success")).toBe("#a8d8ba");
    expect(themeCss).not.toMatch(/--(?:danger|success):\s*var\(--accent\)/);
    expect(tokenDefinition("--danger")).toMatch(/^var\(--palette-danger-/);
    expect(tokenDefinition("--success")).toMatch(/^var\(--palette-success-/);
    expect(tokenDefinition("--accent")).toMatch(/^var\(--palette-accent-/);
  });

  it("keeps generic palette primitives beneath semantic roles", () => {
    const paletteTokens = themeTokens.filter((token) =>
      /^--palette-(?:neutral|accent|earth|success|danger|cool)-\d{3}$/.test(
        token,
      ),
    );

    expect(paletteTokens.length).toBeGreaterThan(0);
    for (const role of [
      "--background",
      "--surface",
      "--surface-raised",
      "--surface-inset",
      "--line",
      "--line-strong",
      "--text",
      "--muted",
      "--accent",
      "--success",
      "--danger",
    ]) {
      expect(tokenDefinition(role)).toMatch(/^var\(--palette-/);
    }
  });

  it("keeps component names exceptional in the palette", () => {
    const componentTerms = [
      "workout",
      "catalog",
      "exercise",
      "set-block",
      "bottom-navigation",
      "dashboard",
      "picker",
      "rest",
      "capsule",
    ];
    const componentTokens = themeTokens.filter((token) =>
      componentTerms.some((term) => token.includes(term)),
    );

    expect(componentTokens.length).toBeLessThanOrEqual(5);
  });

  it("preserves the primary workout CTA gradient endpoint as an accent token", () => {
    expect(tokenValue("--accent-cta-start")).toBe("#ff5a1f");
    expect(tokenValue("--accent-gradient-end")).toBe("#ff3f25");
    expect(redesignCss).toMatch(
      /linear-gradient\(\s*105deg,\s*var\(--accent-cta-start\),\s*var\(--accent-gradient-end\)\s*\)/,
    );
  });

  it("keeps orange accent literals in the palette source", () => {
    for (const css of componentCss) {
      const colors = css.match(/#[\da-fA-F]{3,8}\b/g) ?? [];
      expect(colors.filter(isOrangeAccent)).toEqual([]);
    }
  });
});
