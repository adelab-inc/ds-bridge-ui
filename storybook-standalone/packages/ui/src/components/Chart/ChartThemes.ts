import { AgChartTheme } from 'ag-charts-community';

const defaultTheme: AgChartTheme = {
    baseTheme: 'ag-default',
    palette: {
        fills: ['#1e3a8a', '#60a5fa', '#34d399', '#f59e0b', '#ef4444'],
        strokes: ['#1e3a8a', '#60a5fa', '#34d399', '#f59e0b', '#ef4444'],
    },
};

const darkTheme: AgChartTheme = {
    baseTheme: 'ag-default-dark',
    palette: {
        fills: ['#93c5fd', '#6ee7b7', '#fde047', '#fca5a5', '#d8b4fe'],
        strokes: ['#93c5fd', '#6ee7b7', '#fde047', '#fca5a5', '#d8b4fe'],
    },
};

const colorfulTheme: AgChartTheme = {
    baseTheme: 'ag-default',
};

const businessTheme: AgChartTheme = {
    baseTheme: 'ag-default',
    palette: {
        fills: ['#0284c7', '#f97316', '#16a34a', '#dc2626', '#6d28d9'],
        strokes: ['#0284c7', '#f97316', '#16a34a', '#dc2626', '#6d28d9'],
    },
};

export const CHART_THEMES = {
    default: defaultTheme,
    dark: darkTheme,
    colorful: colorfulTheme,
    business: businessTheme,
};
