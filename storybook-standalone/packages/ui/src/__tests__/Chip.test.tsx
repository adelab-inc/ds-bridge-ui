import { render, screen } from "@testing-library/react";
import { Chip } from "../components/Chip";
import { describe, it, expect } from "vitest";

describe("Chip", () => {
  it("renders correctly with default props", () => {
    render(<Chip data-testid="chip">Test Chip</Chip>);
    const chip = screen.getByTestId("chip");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("Test Chip");
    expect(chip).toHaveClass("inline-flex items-center rounded-full px-component-inset-chip-x py-component-inset-chip-y cursor-pointer text-chip-label-md-medium bg-chip-bg-off text-text-primary border border-transparent hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover)),theme(colors.chip-bg-off)] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed)),theme(colors.chip-bg-off)] focus:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]");
  });

  it("renders with an icon", () => {
    render(<Chip icon={<span>Icon</span>} hasIcon>Test Chip</Chip>);
    expect(screen.getByText("Icon")).toBeInTheDocument();
  });

  it("renders with a close button", () => {
    render(<Chip hasCloseButton>Test Chip</Chip>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("applies disabled state", () => {
    render(<Chip state="disabled">Test Chip</Chip>);
    expect(screen.getByText("Test Chip").parentElement).toHaveClass("text-text-disabled bg-chip-bg-disabled");
  });

  it("applies selected state", () => {
    render(<Chip state="selected">Test Chip</Chip>);
    expect(screen.getByText("Test Chip").parentElement).toHaveClass("text-text-on-selection border border-border-selection bg-chip-bg-selected");
  });

  it("applies focus styles for default state", () => {
    render(<Chip state="default">Test Chip</Chip>);
    const chip = screen.getByText("Test Chip").parentElement;
    expect(chip).toHaveClass("focus:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]");
  });
});
