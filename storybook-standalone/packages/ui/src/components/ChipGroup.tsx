import { cva, type VariantProps } from "class-variance-authority";
import React, { Children, cloneElement, isValidElement, useState } from "react";
import { ChipProps } from "./Chip";
import { cn } from "./utils";

const chipGroupVariants = cva('flex', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
      "variant": {
        "no-scroll": "flex-wrap",
        "scroll": "whitespace-nowrap",
      },
    },
    defaultVariants: {
      "mode": "base",
      "variant": "scroll",
    },
    compoundVariants: [
      {
        "class": "gap-component-gap-tag-group",
        "mode": "base",
      },
      {
        "class": "gap-component-gap-tag-group-compact",
        "mode": "compact",
      },
    ],
  }));

export interface ChipGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chipGroupVariants> {
  size?: "md" | "sm";
  selectionType?: "single" | "multiple";
  children: React.ReactNode;
  defaultValue?: string | string[];
  disabled?: boolean;
}

const ChipGroup = React.forwardRef<HTMLDivElement, ChipGroupProps>(
  ({ className, variant, size, selectionType = "multiple", children, defaultValue, disabled, ...props }, ref) => {
    const [selectedValues, setSelectedValues] = useState<string[]>(() => {
      if (!defaultValue) return [];
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    });
    const [removedValues, setRemovedValues] = useState<string[]>([]);

    const handleChipClick = (value: string) => {
      if (!selectionType) return;

      setSelectedValues((prev) => {
        if (selectionType === "single") {
          return prev.includes(value) ? [] : [value];
        }
        // multiple selection
        const newSelection = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
        return newSelection;
      });
    };

    const handleChipClose = (value: string, originalOnClose?: () => void) => {
      setRemovedValues((prev) => [...prev, value]);
      setSelectedValues((prev) => prev.filter((v) => v !== value));
      originalOnClose?.();
    };

    return (
      <div ref={ref} className={cn(chipGroupVariants({ variant, className }))} {...props}>
        {Children.map(children, (child) => {
          if (!isValidElement<ChipProps & { value?: string }>(child)) {
            return child;
          }

          const value =
            child.props.value || (typeof child.props.label === "string" ? child.props.label : undefined);
          if (!value) {
            console.warn(
              "Chip component inside ChipGroup requires a 'value' prop or a string label for selection to work."
            );
            return child;
          }

          if (removedValues.includes(value)) return null;

          const isSelected = selectedValues.includes(value);

          return cloneElement(child, {
            ...child.props,
            ...(size ? { size } : {}),
            selected: isSelected,
            disabled: disabled || undefined,
            onClick: disabled
              ? undefined
              : (e: React.MouseEvent<HTMLDivElement>) => {
                  handleChipClick(value);
                  child.props.onClick?.(e);
                },
            ...(child.props.showClose
              ? { onClose: () => handleChipClose(value, child.props.onClose) }
              : {}),
          });
        })}
      </div>
    );
  }
);
ChipGroup.displayName = "ChipGroup";

export { ChipGroup, chipGroupVariants };
