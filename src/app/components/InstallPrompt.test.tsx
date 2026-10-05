import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { InstallPrompt } from "./InstallPrompt";
import { INSTALL_DISMISS_KEY } from "../../lib/pwa";

function installEvent() {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as any;
  e.prompt = vi.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome: "accepted" });
  return e;
}

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
});
afterEach(() => vi.useRealTimers());

describe("InstallPrompt", () => {
  it("renders nothing until the browser says the app is installable", () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an Install button on beforeinstallprompt and triggers the native prompt", async () => {
    render(<InstallPrompt />);
    const e = installEvent();
    act(() => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true); // we take over the prompt
    const btn = await screen.findByRole("button", { name: /install/i });
    await act(async () => { fireEvent.click(btn); });
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // the one-shot event is spent
  });

  it("'Dismiss' hides it and remembers for two weeks", () => {
    render(<InstallPrompt />);
    act(() => { window.dispatchEvent(installEvent()); });
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(Number(localStorage.getItem(INSTALL_DISMISS_KEY))).toBeGreaterThan(0);
  });

  it("stays hidden after a recent dismissal", () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() - 86_400_000));
    render(<InstallPrompt />);
    act(() => { window.dispatchEvent(installEvent()); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays hidden when already running as an installed app", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
    render(<InstallPrompt />);
    act(() => { window.dispatchEvent(installEvent()); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("on iOS shows the Share -> Add to Home Screen steps (no install button) after a short delay", () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      configurable: true,
    });
    render(<InstallPrompt />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(8100); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^install$/i })).not.toBeInTheDocument();
  });

  it("disappears when the app gets installed", () => {
    render(<InstallPrompt />);
    act(() => { window.dispatchEvent(installEvent()); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event("appinstalled")); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
