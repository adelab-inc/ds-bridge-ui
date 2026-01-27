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
  selectionType?: "single" | "multiple";
  children: React.ReactNode;
  defaultValue?: string | string[];
  disabled?: boolean;
}

const ChipGroup = React.forwardRef<HTMLDivElement, ChipGroupProps>(
  ({ className, variant, selectionType = "multiple", children, defaultValue, disabled, ...props }, ref) => {
    const [selectedValues, setSelectedValues] = useState<string[]>(() => {
      if (!defaultValue) return [];
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    });

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

    return (
      <div ref={ref} className={cn(chipGroupVariants({ variant, className }))} {...props}>
        {Children.map(children, (child) => {
          if (!isValidElement<ChipProps & { value?: string }>(child)) {
            return child;
          }

          const value =
            child.props.value || (typeof child.props.children === "string" ? child.props.children : undefined);
          if (!value) {
            console.warn(
              "Chip component inside ChipGroup requires a 'value' prop or a string child for selection to work."
            );
            return child;
          }

          const isSelected = selectedValues.includes(value);
          const chipState = disabled ? "disabled" : isSelected ? "selected" : "default";

          return cloneElement(child, {
            ...child.props,
            state: chipState,
            selectionStyle: selectionType,
            onClick: disabled
              ? undefined
              : () => {
                  handleChipClick(value);
                  child.props.onClick?.(child.props as any);
                },
          });
        })}
      </div>
    );
  }
);
ChipGroup.displayName = "ChipGroup";

export { ChipGroup, chipGroupVariants };
