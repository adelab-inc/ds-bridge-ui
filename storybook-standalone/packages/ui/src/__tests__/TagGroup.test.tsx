import { render, screen, fireEvent } from '@testing-library/react'
import { TagGroup } from '../components/TagGroup'
import { Tag } from '../components/Tag' // Import Tag to use it as children

describe('TagGroup', () => {
  it('renders the TagGroup component with default layout', () => {
    render(
      <TagGroup>
        <Tag>Tag 1</Tag>
        <Tag>Tag 2</Tag>
      </TagGroup>
    )
    expect(screen.getByText('Tag 1')).toBeInTheDocument()
    expect(screen.getByText('Tag 2')).toBeInTheDocument()
  })

  it('renders tags in a single line with "more" button when layout is singleLineWithMore and tags exceed maxVisibleTags', () => {
    render(
      <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
        <Tag>Tag 1</Tag>
        <Tag>Tag 2</Tag>
        <Tag>Tag 3</Tag>
        <Tag>Tag 4</Tag>
      </TagGroup>
    )
    expect(screen.getByText('Tag 1')).toBeInTheDocument()
    expect(screen.getByText('Tag 2')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.queryByText('Tag 3')).not.toBeInTheDocument()
  })

  it('expands to show all tags when "more" button is clicked', () => {
    render(
      <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
        <Tag>Tag 1</Tag>
        <Tag>Tag 2</Tag>
        <Tag>Tag 3</Tag>
        <Tag>Tag 4</Tag>
      </TagGroup>
    )
    const moreButton = screen.getByText('+2')
    fireEvent.click(moreButton)
    expect(screen.getByText('Tag 3')).toBeInTheDocument()
    expect(screen.getByText('Tag 4')).toBeInTheDocument()
    expect(screen.queryByText('+2')).not.toBeInTheDocument()
  })

  it('applies horizontalScroll layout correctly', () => {
    render(
      <TagGroup layout="horizontalScroll" data-testid="tag-group-container">
        <Tag>Tag 1</Tag>
        <Tag>Tag 2</Tag>
      </TagGroup>
    )
    const tagGroupElement = screen.getByTestId('tag-group-container')
    expect(tagGroupElement).toHaveClass('flex-nowrap')
    // Note: overflow-x-auto is provided by the Scrollbar wrapper component
  })

  describe('Accessibility - Keyboard Navigation', () => {
    it('expands when Enter key is pressed on More button', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
          <Tag>Tag 4</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+2')
      fireEvent.keyDown(moreButton, { key: 'Enter' })
      expect(screen.getByText('Tag 3')).toBeInTheDocument()
      expect(screen.getByText('Tag 4')).toBeInTheDocument()
    })

    it('expands when Space key is pressed on More button', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
          <Tag>Tag 4</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+2')
      fireEvent.keyDown(moreButton, { key: ' ' })
      expect(screen.getByText('Tag 3')).toBeInTheDocument()
      expect(screen.getByText('Tag 4')).toBeInTheDocument()
    })

    it('collapses when Enter key is pressed on 접기 button', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
          <Tag>Tag 4</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+2')
      fireEvent.click(moreButton)
      expect(screen.getByText('접기')).toBeInTheDocument()

      const collapseButton = screen.getByText('접기')
      fireEvent.keyDown(collapseButton, { key: 'Enter' })
      expect(screen.queryByText('Tag 3')).not.toBeInTheDocument()
      expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('collapses when Space key is pressed on 접기 button', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+1')
      fireEvent.click(moreButton)
      expect(screen.getByText('접기')).toBeInTheDocument()

      const collapseButton = screen.getByText('접기')
      fireEvent.keyDown(collapseButton, { key: ' ' })
      expect(screen.queryByText('Tag 3')).not.toBeInTheDocument()
      expect(screen.getByText('+1')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles maxVisibleTags=0 gracefully (defaults to 1)', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={0} data-testid="tag-group">
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
        </TagGroup>
      )
      // maxVisibleTags=0 should be treated as 1
      expect(screen.getByText('Tag 1')).toBeInTheDocument()
      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('handles negative maxVisibleTags gracefully (defaults to 1)', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={-5} data-testid="tag-group">
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
        </TagGroup>
      )
      // Negative values should be treated as 1
      expect(screen.getByText('Tag 1')).toBeInTheDocument()
      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('handles empty children gracefully', () => {
      render(
        <TagGroup data-testid="tag-group">
          {[]}
        </TagGroup>
      )
      const tagGroup = screen.getByTestId('tag-group')
      expect(tagGroup).toBeInTheDocument()
      expect(tagGroup).toBeEmptyDOMElement()
    })

    it('handles singleLineWithMore with empty children', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={3} data-testid="tag-group" />
      )
      const tagGroup = screen.getByTestId('tag-group')
      expect(tagGroup).toBeInTheDocument()
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility - ARIA Attributes', () => {
    it('More button has correct role and tabIndex', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+1')
      expect(moreButton).toHaveAttribute('role', 'button')
      expect(moreButton).toHaveAttribute('tabIndex', '0')
    })

    it('More button has dynamic aria-label (N개 태그 더보기)', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
          <Tag>Tag 4</Tag>
          <Tag>Tag 5</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+3')
      expect(moreButton).toHaveAttribute('aria-label', '3개 태그 더보기')
    })

    it('More button aria-expanded changes on toggle', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+1')
      expect(moreButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(moreButton)
      const collapseButton = screen.getByText('접기')
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('접기 button has correct aria-label', () => {
      render(
        <TagGroup layout="singleLineWithMore" maxVisibleTags={2}>
          <Tag>Tag 1</Tag>
          <Tag>Tag 2</Tag>
          <Tag>Tag 3</Tag>
        </TagGroup>
      )
      const moreButton = screen.getByText('+1')
      fireEvent.click(moreButton)

      const collapseButton = screen.getByText('접기')
      expect(collapseButton).toHaveAttribute('aria-label', '태그 접기')
    })
  })
})
