// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/Map", () => ({
  MapView: () => <div data-testid="north-map-view" />,
}));

import { InteractiveNorthMap } from "./InteractiveNorthMap";

describe("InteractiveNorthMap return navigation", () => {
  it("returns to the same city destination list and allows choosing another place", () => {
    render(<InteractiveNorthMap />);

    fireEvent.click(screen.getByRole("tab", { name: "يومرا" }));
    expect(screen.getByText("يومرا · الوجهات")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "اختيار وجهة الخريطة رقم 1" }));
    expect(screen.getByRole("region", { name: /تفاصيل/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /العودة لاختيار وجهة أخرى/ }));
    expect(screen.queryByRole("region", { name: /تفاصيل/ })).toBeNull();
    expect(screen.getByText("يومرا · الوجهات")).toBeTruthy();

    const destinations = screen.getAllByRole("button", { name: /اختيار وجهة الخريطة رقم/ });
    expect(destinations.length).toBeGreaterThan(1);
    fireEvent.click(destinations[1]!);
    expect(screen.getByRole("region", { name: /تفاصيل/ })).toBeTruthy();
  });
});
