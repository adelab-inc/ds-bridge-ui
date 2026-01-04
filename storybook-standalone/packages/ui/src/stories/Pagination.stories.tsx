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
    onPageChange: {
      action: 'page changed',
      description: '페이지 변경 시 호출되는 콜백 함수',
    },
    disabled: {
      control: 'boolean',
      description: '페이지네이션 비활성화 여부',
    },
  },
  args: {
    onPageChange: () => {},
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: {
    variant: 'standard',
    totalCount: 1000,
    pageSize: 10,
    currentPage: 1,
    siblingCount: 1,
  },
  render: (args: any) => {
    const [page, setPage] = useState(args.currentPage);
    return <Pagination {...args} currentPage={page} onPageChange={setPage} />;
  },
};

export const Simple: Story = {
  args: {
    variant: 'simple',
    currentPage: 1,
    totalPages: 100,
  },
  render: (args: any) => {
    const [page, setPage] = useState(args.currentPage);
    return <Pagination {...args} currentPage={page} onPageChange={setPage} />;
  },
};

export const StandardWithManyPages: Story = {
  args: {
    variant: 'standard',
    totalCount: 5000,
    pageSize: 10,
    currentPage: 50,
    siblingCount: 2,
  },
  render: (args: any) => {
    const [page, setPage] = useState(args.currentPage);
    return <Pagination {...args} currentPage={page} onPageChange={setPage} />;
  },
};

export const DisabledPagination: Story = {
  args: {
    variant: 'standard',
    totalCount: 1000,
    pageSize: 10,
    currentPage: 1,
    siblingCount: 1,
    disabled: true,
  },
  render: (args: any) => {
    const [page, setPage] = useState(args.currentPage);
    return <Pagination {...args} currentPage={page} onPageChange={setPage} />;
  },
};