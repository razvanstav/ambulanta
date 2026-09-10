import { expect, it } from "vitest";
import { hasSameOrigin } from "./request-origin";

it("verifică originea față de gazda cererii, inclusiv portul local și proxy HTTPS", () => {
  expect(hasSameOrigin("http://127.0.0.1:3100", "127.0.0.1:3100")).toBe(true);
  expect(hasSameOrigin("https://demo.netlify.app", "demo.netlify.app")).toBe(true);
  for (const origin of [
    null,
    "null",
    "https://foreign.example",
    "https://demo.netlify.app.evil.test",
    "https://demo.netlify.app/path",
    "http://127.0.0.1:9999",
  ])
    expect(hasSameOrigin(origin, "demo.netlify.app")).toBe(false);
});
