import { Link as RouterLink, type LinkProps as RouterLinkProps } from '@tanstack/react-router';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';

const linkVariants = cva("'inline-flex justify-center items-center'", ({
    variants: {
      "size": {
        "lg": "text-body-lg-regular",
        "md": "text-body-md-regular",
        "sm": "text-body-sm-regular",
      },
      "variant": {
        "always-inherit": "text-text-primary underline underline-offset-auto",
        "always-link": "text-text-semantic-info underline underline-offset-auto",
        "none-inherit": "text-text-primary",
        "none-link": "text-text-semantic-info",
        "on-hover-inherit": "text-text-primary hover:underline hover:underline-offset-auto",
        "on-hover-link": "text-text-semantic-info hover:underline hover:underline-offset-auto",
      },
    },
    defaultVariants: {
      "size": "md",
      "variant": "on-hover-link",
    },
  }));

// 내부 라우팅을 위한 LinkProps 정의
interface InternalLinkProps extends RouterLinkProps {
  to: string;
  href?: never;
}

// 외부 링크를 위한 AnchorProps 정의
interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  to?: never;
}

// VariantProps와 공통 prop 정의
type LinkVariantProps = VariantProps<typeof linkVariants>;
type CommonProps = {
  children: React.ReactNode;
  className?: string;
} & LinkVariantProps;

// 최종 LinkProps 타입
export type LinkProps = CommonProps & (InternalLinkProps | ExternalLinkProps);

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    const classes = cn(linkVariants({ variant, size, className }));

    if ('to' in props) {
      // 내부 라우팅 (TanStack Router Link)
      return (
        <RouterLink ref={ref} className={classes} {...props}>
          {children}
        </RouterLink>
      );
    }

    // 외부 링크 (일반 a 태그)
    const { href, ...rest } = props as ExternalLinkProps;
    return (
      <a
        ref={ref}
        href={href}
        className={classes}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
Link.displayName = 'Link';

export { Link, linkVariants };
