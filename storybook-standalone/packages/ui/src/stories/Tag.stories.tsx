import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Tag } from '../components/Tag'
import { TagGroup } from '../components/TagGroup'

const meta: Meta<typeof Tag> = {
  title: 'UI/Tag',
  component: Tag,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Tag 내부 텍스트',
    },
    variant: {
      control: 'select',
      options: ['default', 'more'],
      description: 'Tag variant',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    colorSwatch: {
      control: 'select',
      options: ['red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'violet', 'pink', undefined],
      description: 'Tag 색상 스워치',
    },
    hasCloseButton: {
      control: 'boolean',
      description: '닫기 버튼 표시 여부',
    },
    onClose: { table: { disable: true } },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Tag Label',
    variant: 'default',
    mode: 'base',
    colorSwatch: undefined,
    hasCloseButton: false,
    onClose: () => console.log('Tag closed'),
  },
}

export const TagGroupWrap: Story = {
  render: () => {
    const colors = ['red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'violet', 'pink']
    const tags = Array.from({ length: 8 }, (_, i) => {
      const hasColor = i % 2 === 1
      const hasCloseButton = i % 3 === 0
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
