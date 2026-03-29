import Lottie from 'lottie-react';
import * as React from 'react';
import blueSpinner from '../assets/lottie/Blue.json';
import greySpinner from '../assets/lottie/Grey.json';
import redSpinner from '../assets/lottie/Red.json';
import whiteSpinner from '../assets/lottie/White.json';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'tertiary' | 'destructive' | 'secondary-destructive' | 'ghost-inverse';
type IconButtonVariant = 'ghost' | 'secondary' | 'tertiary' | 'ghost-destructive';

interface LoadingSpinnerProps {
  variant: ButtonVariant | IconButtonVariant;
  size?: number;
  componentType?: 'button' | 'iconButton';
}

const buttonSpinnerMap: Record<ButtonVariant, any> = {
  primary: whiteSpinner,
  secondary: greySpinner,
  ghost: blueSpinner,
  tertiary: greySpinner,
  destructive: whiteSpinner,
  'secondary-destructive': redSpinner,
  'ghost-inverse': whiteSpinner,
};

const iconButtonSpinnerMap: Record<IconButtonVariant, any> = {
  ghost: greySpinner,
  secondary: greySpinner,
  tertiary: greySpinner,
  'ghost-destructive': redSpinner,
};

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ variant, size = 20, componentType = 'button' }, ref) => {
    const animationData = componentType === 'iconButton'
      ? iconButtonSpinnerMap[variant as IconButtonVariant]
      : buttonSpinnerMap[variant as ButtonVariant];

    return (
      <div ref={ref} style={{ width: size, height: size, display: 'inline-flex' }}>
        <Lottie animationData={animationData} loop autoplay />
      </div>
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';
