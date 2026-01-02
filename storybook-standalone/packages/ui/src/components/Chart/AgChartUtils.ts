import { AgBarSeriesOptions, AgLineSeriesOptions, AgCartesianAxisOptions } from 'ag-charts-community';

type LineSeriesOptions = {
    strokeWidth?: number;
    markerEnabled?: boolean;
    markerSize?: number;
    labelEnabled?: boolean;
};

/**
 * 기본 축(X축, Y축) 설정을 생성합니다.
 * @param xAxisOptions - X축 옵션
 * @param yAxisOptions - Y축 옵션
 */
function createBasicAxes(xAxisOptions: Partial<AgCartesianAxisOptions> = {}, yAxisOptions: Partial<AgCartesianAxisOptions> = {}): AgCartesianAxisOptions[] {
    return [
        {
            position: 'bottom',
            ...xAxisOptions,
        } as AgCartesianAxisOptions,
        {
            position: 'left',
            ...yAxisOptions,
        } as AgCartesianAxisOptions,
    ];
}

/**
 * 듀얼 Y축 설정을 생성합니다.
 * @param leftAxisOptions - 왼쪽 Y축 옵션
 * @param rightAxisOptions - 오른쪽 Y축 옵션
 */
function createDualYAxes(leftAxisOptions: Partial<AgCartesianAxisOptions>, rightAxisOptions: Partial<AgCartesianAxisOptions>): AgCartesianAxisOptions[] {
    return [
        {
            position: 'left',
            ...leftAxisOptions,
        } as AgCartesianAxisOptions,
        {
            position: 'right',
            nice: false,
            ...rightAxisOptions,
        } as AgCartesianAxisOptions,
    ];
}

/**
 * 막대 시리즈(Bar Series) 옵션을 생성합니다.
 * @param xKey - X축에 매핑될 데이터 키
 * @param yKey - Y축에 매핑될 데이터 키
 * @param yName - 시리즈 이름 (범례에 표시)
 * @param fill - 막대 색상
 */
function createBarSeries(xKey: string, yKey: string, yName: string, fill: string): AgBarSeriesOptions {
    return {
        type: 'bar',
        xKey,
        yKey,
        yName,
        fill,
        strokeWidth: 0,
    };
}

/**
 * 선 시리즈(Line Series) 옵션을 생성합니다.
 * @param xKey - X축에 매핑될 데이터 키
 * @param yKey - Y축에 매핑될 데이터 키
 * @param yName - 시리즈 이름 (범례에 표시)
 * @param stroke - 선 색상
 * @param options - 추가적인 선 시리즈 옵션
 */
function createLineSeries(xKey: string, yKey: string, yName: string, stroke: string, options: LineSeriesOptions = {}): AgLineSeriesOptions {
    const { strokeWidth = 2, markerEnabled = true, markerSize = 8, labelEnabled = true } = options;
    return {
        type: 'line',
        xKey,
        yKey,
        yName,
        stroke,
        strokeWidth,
        marker: {
            enabled: markerEnabled,
            fill: stroke,
            size: markerSize,
        },
        label: {
            enabled: labelEnabled,
            formatter: (params: any) => params.value?.toFixed(0) || '',
        },
    };
}

export const AgChartUtils = {
    createBasicAxes,
    createDualYAxes,
    createBarSeries,
    createLineSeries,
};
