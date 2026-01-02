import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { Tag } from '../components/Tag'

describe('Tag', () => {
  it('renders the Tag component with default props', () => {
    render(<Tag>Test Tag</Tag>)
    expect(screen.getByText('Test Tag')).toBeInTheDocument()
  })

  it('renders a close button when hasCloseButton is true', () => {
    const handleClose = vi.fn()
    render(<Tag hasCloseButton onClose={handleClose}>Closable Tag</Tag>)
    const closeButton = screen.getByRole('button')
    expect(closeButton).toBeInTheDocument()
    fireEvent.click(closeButton)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('applies the correct variant classes', () => {
    render(<Tag variant="more">More Tag</Tag>)
    expect(screen.getByText('More Tag')).toHaveClass('border') // Check for a class specific to the 'more' variant
  })

  describe('Edge Cases', () => {
    it('handles invalid colorSwatch gracefully (no color swatch rendered)', () => {
      render(<Tag colorSwatch={"invalidColor" as any}>Test Tag</Tag>)
      expect(screen.getByText('Test Tag')).toBeInTheDocument()
      expect(screen.queryByTestId('color-swatch')).not.toBeInTheDocument()
    })

    it('handles valid colorSwatch correctly', () => {
      render(<Tag colorSwatch="red">Test Tag</Tag>)
      expect(screen.getByText('Test Tag')).toBeInTheDocument()
      const colorSwatch = screen.getByTestId('color-swatch')
      expect(colorSwatch).toBeInTheDocument()
      expect(colorSwatch).toHaveClass('bg-hue-red-500')
    })

    it('handles hasCloseButton without onClose (no button rendered)', () => {
      render(<Tag hasCloseButton>Test Tag</Tag>)
      expect(screen.getByText('Test Tag')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('handles empty children with close button (aria-label defaults to "태그")', () => {
      const handleClose = vi.fn()
      render(<Tag hasCloseButton onClose={handleClose}>{''}</Tag>)
      const closeButton = screen.getByRole('button')
      expect(closeButton).toHaveAttribute('aria-label', '태그 태그 제거')
    })

    it('handles complex children with close button (aria-label defaults to "태그")', () => {
      const handleClose = vi.fn()
      render(
        <Tag hasCloseButton onClose={handleClose}>
          <div>Complex</div>
        </Tag>
      )
      const closeButton = screen.getByRole('button')
      expect(closeButton).toHaveAttribute('aria-label', '태그 태그 제거')
    })

    it('handles number children correctly', () => {
      const handleClose = vi.fn()
      render(<Tag hasCloseButton onClose={handleClose}>{123}</Tag>)
      expect(screen.getByText('123')).toBeInTheDocument()
      const closeButton = screen.getByRole('button')
      expect(closeButton).toHaveAttribute('aria-label', '123 태그 제거')
    })
  })

  describe('colorSwatch - All Colors', () => {
    const validColors = ['red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'violet', 'pink']
    const colorClassMap: Record<string, string> = {
      red: 'bg-hue-red-500',
      orange: 'bg-hue-orange-500',
      yellow: 'bg-hue-yellow-500',
      lime: 'bg-hue-lime-500',
      green: 'bg-hue-green-500',
      cyan: 'bg-hue-cyan-500',
      violet: 'bg-hue-violet-500',
      pink: 'bg-hue-pink-500',
    }

    validColors.forEach((color) => {
      it(`renders ${color} colorSwatch correctly`, () => {
        render(<Tag colorSwatch={color as any}>{color} Tag</Tag>)
        expect(screen.getByText(`${color} Tag`)).toBeInTheDocument()
        const colorSwatch = screen.getByTestId('color-swatch')
        expect(colorSwatch).toBeInTheDocument()
        expect(colorSwatch).toHaveClass(colorClassMap[color])
      })
    })
  })

  describe('Accessibility - ARIA Attributes', () => {
    it('colorSwatch has aria-hidden="true"', () => {
      render(<Tag colorSwatch="red">Test Tag</Tag>)
      const colorSwatch = screen.getByTestId('color-swatch')
      expect(colorSwatch).toHaveAttribute('aria-hidden', 'true')
    })

    it('close button Icon has aria-hidden="true"', () => {
      const handleClose = vi.fn()
      render(
        <Tag hasCloseButton onClose={handleClose}>Test Tag</Tag>
      )
      const closeButton = screen.getByRole('button')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const icon = closeButton.querySelector('svg')
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    })

    it('close button has correct aria-label with tag text', () => {
      const handleClose = vi.fn()
      render(<Tag hasCloseButton onClose={handleClose}>My Tag</Tag>)
      const closeButton = screen.getByRole('button')
      expect(closeButton).toHaveAttribute('aria-label', 'My Tag 태그 제거')
    })
  })
})
