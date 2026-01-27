import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useState } from 'react';
import { Pagination } from '../components/Pagination/Pagination';

const meta: Meta<typeof Pagination> = {
  title: 'UI/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['standard', 'simple'],
      description: '페이지네이션의 종류를 선택합니다.',
    },
    currentPage: {
      control: 'number',
      description: '현재 페이지 번호',
    },
    disabled: {
      control: 'boolean',
      description: '페이지네이션 비활성화 여부',
    },
    totalCount: {
      control: 'number',
      description: '전체 항목 수 (standard variant)',
    },
    pageSize: {
      control: 'number',
      description: '페이지당 항목 수 (standard variant)',
    },
    siblingCount: {
      control: 'number',
      description: '현재 페이지 양쪽에 표시할 페이지 수',
    },
    onPageChange: { table: { disable: true } },
    totalPages: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'standard',
    totalCount: 1000,
    pageSize: 10,
    currentPage: 1,
    siblingCount: 1,
    disabled: false,
  },
  render: (args: any) => {
    const [page, setPage] = useState(args.currentPage);
    return <Pagination {...args} currentPage={page} onPageChange={setPage} />;
  },
};
