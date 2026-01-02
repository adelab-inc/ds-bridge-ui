import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Tag } from '../components/Tag'
import { TagGroup } from '../components/TagGroup'
import { Scrollbar } from '../components/Scrollbar'

const meta: Meta<typeof Tag> = {
  title: 'UI/Tag',
  component: Tag,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'more'],
    },
    colorSwatch: {
      control: 'select',
      options: ['red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'violet', 'pink', undefined],
    },
    hasCloseButton: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Tag Label',
    variant: 'default',
    colorSwatch: undefined,
    hasCloseButton: false,
  },
}

export const WithColorSwatch: Story = {
  args: {
    children: 'Category',
    variant: 'default',
    colorSwatch: 'violet',
    hasCloseButton: false,
  },
}

export const WithCloseButton: Story = {
  args: {
    children: 'Filter',
    variant: 'default',
    colorSwatch: undefined,
    hasCloseButton: true,
  },
}

export const WithBoth: Story = {
  args: {
    children: 'Status',
    variant: 'default',
    colorSwatch: 'green',
    hasCloseButton: true,
  },
}

export const More: Story = {
  args: {
    children: '+3',
    variant: 'more',
    colorSwatch: undefined,
    hasCloseButton: false,
  },
}

export const TagGroupWrap: Story = {
  argTypes: {
    tagCount: {
      control: { type: 'number', min: 1, max: 30 },
      description: 'Number of tags to display',
    },
  },
  args: {
    tagCount: 15,
  },
  render: (args) => {
    const colors = ['red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'violet', 'pink']
    const tags = Array.from({ length: args.tagCount || 15 }, (_, i) => {
      const hasColor = i % 3 === 1
      const hasCloseButton = i % 5 === 2
      const colorIndex = i % colors.length

      return (
        <Tag
          key={i}
          colorSwatch={hasColor ? colors[colorIndex] : undefined}
          hasCloseButton={hasCloseButton}
        >
          Tag {i + 1}
        </Tag>
      )
    })

    return (
      <TagGroup layout="wrap" className="w-[400px]">
        {tags}
      </TagGroup>
    )
  },
}

export const TagGroupSingleLineWithMore: Story = {
  render: () => (
    <TagGroup layout="singleLineWithMore" maxVisibleTags={3} className="w-[400px]">
      <Tag>Tag 1</Tag>
      <Tag colorSwatch="red">Tag 2</Tag>
      <Tag hasCloseButton>Tag 3</Tag>
      <Tag colorSwatch="cyan">Tag 4</Tag>
      <Tag>Tag 5</Tag>
      <Tag>Tag 6</Tag>
      <Tag>Tag 7</Tag>
      <Tag>Tag 8</Tag>
    </TagGroup>
  ),
}

export const TagGroupHorizontalScroll: Story = {
  render: () => (
    <Scrollbar className="w-[400px]">
      <TagGroup layout="horizontalScroll">
        <Tag>Tag 1</Tag>
        <Tag colorSwatch="red">Tag 2</Tag>
        <Tag hasCloseButton>Tag 3</Tag>
        <Tag colorSwatch="cyan">Tag 4</Tag>
        <Tag>Tag 5</Tag>
        <Tag colorSwatch="orange">Tag 6</Tag>
        <Tag>Tag 7</Tag>
        <Tag colorSwatch="green">Tag 8</Tag>
        <Tag>Tag 9</Tag>
        <Tag colorSwatch="violet">Tag 10</Tag>
        <Tag hasCloseButton>Tag 11</Tag>
        <Tag>Tag 12</Tag>
        <Tag colorSwatch="pink">Tag 13</Tag>
        <Tag>Tag 14</Tag>
        <Tag colorSwatch="yellow">Tag 15</Tag>
        <Tag>Tag 16</Tag>
        <Tag colorSwatch="lime">Tag 17</Tag>
        <Tag>Tag 18</Tag>
        <Tag hasCloseButton>Tag 19</Tag>
        <Tag>Tag 20</Tag>
      </TagGroup>
    </Scrollbar>
  ),
}