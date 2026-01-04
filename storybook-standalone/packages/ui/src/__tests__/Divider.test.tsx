import { render, screen } from "@testing-library/react";
import { Divider } from "../components/Divider";
import { describe, it, expect } from "vitest";

describe("Divider", () => {
  it("renders correctly with default props", () => {
    render(<Divider data-testid="divider" />);
    const divider = screen.getByTestId("divider");
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveClass("flex-shrink-0 h-px w-full bg-border-default");
  });

  it("renders with vertical orientation", () => {
    render(<Divider data-testid="divider" orientation="vertical" />);
    const divider = screen.getByTestId("divider");
    expect(divider).toHaveClass("w-px h-full");
  });

  it("renders with subtle color", () => {
    render(<Divider data-testid="divider" color="subtle" />);
    const divider = screen.getByTestId("divider");
    expect(divider).toHaveClass("bg-border-subtle");
  });

  it("renders with strong color", () => {
    render(<Divider data-testid="divider" color="strong" />);
    const divider = screen.getByTestId("divider");
    expect(divider).toHaveClass("bg-border-strong");
  });

  it("applies custom className", () => {
    render(<Divider data-testid="divider" className="custom-class" />);
    const divider = screen.getByTestId("divider");
    expect(divider).toHaveClass("custom-class");
  });
});
