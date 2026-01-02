import type { Meta, StoryObj } from '@storybook/react';
import { AgChartComponent, AgChartUtils, ChartOptionsHelper, CHART_THEMES } from '../components/Chart';

const meta: Meta<typeof AgChartComponent> = {
    title: 'Components/Chart',
    component: AgChartComponent,
    tags: ['autodocs'],
    argTypes: {
        height: { control: 'number' },
        width: { control: 'text' },
        minWidth: { control: 'text' },
        enableScrollX: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<typeof AgChartComponent>;

const sampleData = [
    { department: '수도권본부', value1: 1254, value2: 601, lineValue: 95 },
    { department: '강남본부', value1: 1230, value2: 602, lineValue: 95 },
    { department: '강북본부', value1: 1150, value2: 550, lineValue: 92 },
    { department: '경인본부', value1: 1100, value2: 500, lineValue: 90 },
    { department: '부산본부', value1: 1050, value2: 480, lineValue: 88 },
    { department: '대구본부', value1: 1000, value2: 460, lineValue: 85 },
    { department: '광주본부', value1: 950, value2: 440, lineValue: 82 },
    { department: '대전본부', value1: 900, value2: 420, lineValue: 80 },
    { department: '제주본부', value1: 850, value2: 400, lineValue: 78 },
];

export const BarChart: Story = {
    args: {
        height: 500,
        options: ChartOptionsHelper.createComboChartOptions(
            sampleData,
            '본부별 실적 현황 (Bar Chart)',
            'department',
            [
                { yKey: 'value1', yName: '지표1', fill: '#1e3a8a' },
                { yKey: 'value2', yName: '지표2', fill: '#60a5fa' },
            ],
            [],
            {
                leftAxisMax: 1500,
                xLabelRotation: -45,
                xLabelFontSize: 10,
            }
        ),
        minWidth: 1200,
        enableScrollX: true,
    },
};

export const LineChart: Story = {
    args: {
        height: 500,
        options: ChartOptionsHelper.createComboChartOptions(
            sampleData,
            '본부별 목표달성률 (Line Chart)',
            'department',
            [],
            [{ yKey: 'lineValue', yName: '목표달성률', stroke: '#dc2626' }],
            {
                rightAxisMax: 120,
                xLabelRotation: -45,
                xLabelFontSize: 10,
            }
        ),
        minWidth: 1200,
        enableScrollX: true,
    },
};

export const ComboChart: Story = {
    args: {
        height: 500,
        minWidth: 1200,
        enableScrollX: true,
        options: ChartOptionsHelper.createComboChartOptions(
            sampleData,
            '본부별 실적 및 달성률 현황 (Combo Chart)',
            'department',
            [
                { yKey: 'value1', yName: '지표1', fill: '#1e3a8a' },
                { yKey: 'value2', yName: '지표2', fill: '#60a5fa' },
            ],
            [{ yKey: 'lineValue', yName: '달성률', stroke: '#dc2626' }],
            {
                leftAxisMax: 1500,
                rightAxisMax: 120,
                xLabelRotation: -45,
                xLabelFontSize: 10,
            }
        ),
    },
};

export const DarkTheme: Story = {
    args: {
        ...(ComboChart.args ?? {}),
        options: {
            ...(ComboChart.args?.options ?? {}),
            theme: CHART_THEMES.dark,
            title: {
                ...(ComboChart.args?.options?.title ?? {}),
                text: '다크 테마 (Dark Theme)',
            },
        },
    },
    parameters: {
        backgrounds: { default: 'dark' },
    },
};

const pieSampleData = sampleData.slice(0, 5).map((d) => ({
    asset: d.department,
    amount: d.value1,
}));

export const PieChart: Story = {
    args: {
        height: 500,
        options: {
            data: pieSampleData,
            title: {
                text: '본부별 실적 비중 (Pie Chart)',
            },
            series: [
                {
                    type: 'pie',
                    angleKey: 'amount',
                    legendItemKey: 'asset',
                },
            ],
        },
    },
};

export const DonutChart: Story = {
    args: {
        height: 500,
        options: {
            data: pieSampleData,
            title: {
                text: '본부별 실적 비중 (Donut Chart)',
            },
            series: [
                {
                    type: 'donut',
                    angleKey: 'amount',
                    legendItemKey: 'asset',
                    innerRadiusRatio: 0.6,
                },
            ],
        },
    },
};
