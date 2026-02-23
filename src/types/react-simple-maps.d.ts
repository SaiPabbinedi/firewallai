declare module 'react-simple-maps' {
    import { ComponentType, ReactNode, CSSProperties } from 'react';

    interface ProjectionConfig {
        center?: [number, number];
        rotate?: [number, number, number];
        parallels?: [number, number];
        scale?: number;
    }

    interface ComposableMapProps {
        projection?: string;
        projectionConfig?: ProjectionConfig;
        width?: number;
        height?: number;
        style?: CSSProperties;
        children?: ReactNode;
    }

    interface GeographiesProps {
        geography: string | Record<string, unknown>;
        children: (args: { geographies: Geography[] }) => ReactNode;
    }

    interface Geography {
        rsSVGElement?: { key: string };
        properties?: Record<string, unknown>;
        [key: string]: unknown;
    }

    interface GeographyProps {
        geography: Geography;
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        strokeOpacity?: number;
        style?: {
            default?: CSSProperties;
            hover?: CSSProperties;
            pressed?: CSSProperties;
        };
        [key: string]: unknown;
    }

    interface MarkerProps {
        coordinates: [number, number];
        children?: ReactNode;
        onClick?: () => void;
        style?: CSSProperties;
        [key: string]: unknown;
    }

    interface LineProps {
        from: [number, number];
        to: [number, number];
        stroke?: string;
        strokeWidth?: number;
        strokeOpacity?: number;
        strokeLinecap?: string;
        style?: CSSProperties;
        [key: string]: unknown;
    }

    export const ComposableMap: ComponentType<ComposableMapProps>;
    export const Geographies: ComponentType<GeographiesProps>;
    export const Geography: ComponentType<GeographyProps>;
    export const Marker: ComponentType<MarkerProps>;
    export const Line: ComponentType<LineProps>;
}
