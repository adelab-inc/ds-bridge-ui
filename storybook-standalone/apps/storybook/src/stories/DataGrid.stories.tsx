import type { Meta, StoryObj } from '@storybook/react';
import { DataGrid, DataGridProps } from '@aplus/ui';
import { ColDef } from 'ag-grid-community';
import React from 'react';

const meta: Meta<typeof DataGrid> = {
  title: 'Components/DataGrid',
  component: DataGrid,
  tags: ['autodocs'],
  argTypes: {
    height: { control: 'text' },
    width: { control: 'text' },
    theme: {
      control: 'select',
      options: ['alpine', 'balham', 'material', 'custom'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataGrid>;

const defaultRowData = [
  { make: 'Toyota', model: 'Celica', price: 35000 },
  { make: 'Ford', model: 'Mondeo', price: 32000 },
  { make: 'Porsche', model: 'Boxster', price: 72000 },
  { make: 'BMW', model: 'M5', price: 90000 },
  { make: 'Audi', model: 'A4', price: 40000 },
];

const defaultColDefs: ColDef[] = [
  { headerName: 'Make', field: 'make', checkboxSelection: true, filter: true },
  { headerName: 'Model', field: 'model', filter: true },
  { headerName: 'Price', field: 'price', filter: 'agNumberColumnFilter' },
];

const Template = (args: DataGridProps) => <DataGrid {...args} />;

export const Default: Story = {
  args: {
    rowData: defaultRowData,
    columnDefs: defaultColDefs,
    height: 400,
    width: '100%',
    theme: 'alpine',
    pagination: true,
    paginationPageSize: 10,
    rowSelection: 'multiple',
  },
};

export const AutoHeight: Story = {
  args: {
    ...Default.args,
    domLayout: 'autoHeight',
    height: undefined, // autoHeight requires height to be undefined
  },
};

export const CustomTheme = (args: DataGridProps) => (
  <>
    <style>
      {`
        .ag-theme-custom {
          --ag-background-color: #f0f8ff;
          --ag-header-background-color: #d6eaf8;
          --ag-odd-row-background-color: #f0f8ff;
          --ag-row-hover-color: #d4e6f1;
          --ag-font-family: 'Comic Sans MS', cursive, sans-serif;
          --ag-font-size: 14px;
          --ag-border-color: #aed6f1;
        }
      `}
    </style>
    <DataGrid {...args} />
  </>
);

CustomTheme.args = {
  ...Default.args,
  theme: 'custom',
};
