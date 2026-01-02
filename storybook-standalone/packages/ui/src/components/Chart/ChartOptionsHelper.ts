
import { AgChartOptions } from 'ag-charts-community';

type BarSeriesConfig = {
    yKey: string;
    yName: string;
    fill: string;
};

type LineSeriesConfig = {
    yKey: string;
    yName: string;
    stroke: string;
};

type ComboChartConfig = {
    leftAxisMax?: number;
    rightAxisMax?: number;
    xLabelRotation?: number;
    xLabelFontSize?: number;
};

function createComboChartOptions(
    data: any[],
    title: string,
    xKey: string,
    barSeries: BarSeriesConfig[],
    lineSeries: LineSeriesConfig[],
    config: ComboChartConfig = {}
): AgChartOptions {
    const { leftAxisMax, rightAxisMax, xLabelRotation = 0, xLabelFontSize = 12 } = config;

    const leftAxisKeys = barSeries.map(s => s.yKey);
    const rightAxisKeys = lineSeries.map(s => s.yKey);

    const options: AgChartOptions = {
        data,
        title: {
            text: title,
        },
        series: [
            ...barSeries.map(s => ({
                type: 'bar' as const,
                xKey,
                yKey: s.yKey,
                yName: s.yName,
                fill: s.fill,
                strokeWidth: 0,
            })),
            ...lineSeries.map(s => ({
                type: 'line' as const,
                xKey,
                yKey: s.yKey,
                yName: s.yName,
                stroke: s.stroke,
                strokeWidth: 2,
                marker: {
                    enabled: true,
                    fill: s.stroke,
                    size: 8,
                },
                label: {
                    enabled: true,
                    formatter: (params: any) => params.value?.toFixed(0) || '',
                },
            })),
        ],
        axes: [
            {
                type: 'category',
                position: 'bottom',
                label: {
                    rotation: xLabelRotation,
                    fontSize: xLabelFontSize,
                },
            },
            {
                type: 'number',
                position: 'left',
                keys: leftAxisKeys,
                title: {
                    text: 'Value', // This could be parameterized if needed
                },
                max: leftAxisMax,
            },
            {
                type: 'number',
                position: 'right',
                keys: rightAxisKeys,
                title: {
                    text: 'Percentage', // This could be parameterized if needed
                },
                max: rightAxisMax,
                nice: false,
            },
        ],
        legend: {
            enabled: true,
            position: 'bottom',
        },
    };

    return options;
}

export const ChartOptionsHelper = {
    createComboChartOptions,
};
