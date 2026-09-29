import { triggerHaptic } from "./haptics";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("sends the three short patterns with the navigator receiver", () => {
  const vibrate = vi.fn(function (this: Navigator) {
    expect(this).toBe(navigator);
    return true;
  });
  vi.stubGlobal("navigator", { vibrate });
  triggerHaptic("light");
  triggerHaptic("medium");
  triggerHaptic("success");
  expect(vibrate.mock.calls).toEqual([[20], [50], [[25, 35, 45]]]);
});

it.each([undefined, {}, { vibrate: null }, { vibrate: false }])(
  "is a silent no-op without an API: %j",
  (value) => {
    vi.stubGlobal("navigator", value);
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    expect(() => triggerHaptic("light")).not.toThrow();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  },
);

it("tolerates a browser rejecting or throwing and never retries", () => {
  const vibrate = vi
    .fn()
    .mockReturnValueOnce(false)
    .mockImplementationOnce(() => {
      throw new Error("Denied");
    });
  vi.stubGlobal("navigator", { vibrate });
  expect(() => triggerHaptic("light")).not.toThrow();
  expect(() => triggerHaptic("success")).not.toThrow();
  expect(vibrate).toHaveBeenCalledTimes(2);
});

it("does not send feedback from a hidden document", () => {
  const vibrate = vi.fn();
  vi.stubGlobal("navigator", { vibrate });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  triggerHaptic("medium");
  expect(vibrate).not.toHaveBeenCalled();
});
