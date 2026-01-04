import Lottie from 'lottie-react';
import * as React from 'react';
import blueSpinner from '../assets/lottie/Blue.json';
import greySpinner from '../assets/lottie/Grey.json';
import redSpinner from '../assets/lottie/Red.json';
import whiteSpinner from '../assets/lottie/White.json';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'tertiary' | 'destructive' | 'outline-destructive';
type IconButtonVariant = 'ghost' | 'secondary' | 'tertiary' | 'ghost-destructive';

interface LoadingSpinnerProps {
  variant: ButtonVariant | IconButtonVariant;
  size?: number;
}

const spinnerMap: Record<ButtonVariant | IconButtonVariant, any> = {
  // Button variants
  primary: whiteSpinner,
  secondary: greySpinner,
  outline: blueSpinner,
  tertiary: greySpinner,
  destructive: whiteSpinner,
  'outline-destructive': redSpinner,
  // IconButton variants
  ghost: greySpinner,
  'ghost-destructive': redSpinner,
};

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ variant, size = 20 }, ref) => {
    const animationData = spinnerMap[variant];

    return (
      <div ref={ref} style={{ width: size, height: size, display: 'inline-flex' }}>
        <Lottie animationData={animationData} loop autoplay />
      </div>
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';
