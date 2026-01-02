import React, { useMemo } from 'react';
import { AgCharts, AgChartProps } from 'ag-charts-react';
import { AgChartOptions } from 'ag-charts-community';

export interface AgChartComponentProps {
    options: AgChartOptions;
    height?: number | string;
    width?: number | string;
    minWidth?: number | string;
    className?: string;
    style?: React.CSSProperties;
    enableScrollX?: boolean;
    enableScrollY?: boolean;
}

export const AgChartComponent: React.FC<AgChartComponentProps> = ({
    options,
    height = 500,
    width = '100%',
    minWidth,
    className = '',
    style = {},
    enableScrollX = false,
    enableScrollY = false,
}) => {
    const containerStyle: React.CSSProperties = {
        height,
        width,
        ...style,
    };

    if (enableScrollX || enableScrollY) {
        containerStyle.overflowX = enableScrollX ? 'auto' : 'hidden';
        containerStyle.overflowY = enableScrollY ? 'auto' : 'hidden';
    }

    const chartWrapperStyle: React.CSSProperties = {
        height: '100%',
        width: '100%',
        minWidth: minWidth,
    };

    const chartProps: AgChartProps = useMemo(
        () => ({
            options,
        }),
        [options]
    );

    return (
        <div style={containerStyle} className={className}>
            <div style={chartWrapperStyle}>{React.createElement(AgCharts as any, chartProps)}</div>
        </div>
    );
};
