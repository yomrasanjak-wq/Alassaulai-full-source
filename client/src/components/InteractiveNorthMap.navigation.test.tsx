// @vitest-environment jsdom
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/Map", () => ({
  MapView: () => <div data-testid="north-map-view" />,
}));

import { InteractiveNorthMap } from "./InteractiveNorthMap";

describe("InteractiveNorthMap return navigation", () => {
  it("keeps the same city list after the parent clears the selected destination request", () => {
    function Harness() {
      const [request, setRequest] = useState<{ name: string; city: string; query: string } | null>({
        name: "مرتفعات يومرا",
        city: "يومرا",
        query: "Yomra Yaylası Trabzon",
      });
      return (
        <InteractiveNorthMap
          destinationRequest={request}
          onBackToDestinations={() => setRequest(null)}
        />
      );
    }

    render(<Harness />);
    expect(screen.getByRole("region", { name: /تفاصيل مرتفعات يومرا/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /العودة لاختيار وجهة أخرى/ }));
    expect(screen.queryByRole("region", { name: /تفاصيل/ })).toBeNull();
    expect(screen.getByText("يومرا · الوجهات")).toBeTruthy();

    const destinations = screen.getAllByRole("button", { name: /اختيار وجهة الخريطة رقم/ });
    expect(destinations.length).toBeGreaterThan(1);
    fireEvent.click(destinations[1]!);
    expect(screen.getByRole("region", { name: /تفاصيل/ })).toBeTruthy();
  });
});
