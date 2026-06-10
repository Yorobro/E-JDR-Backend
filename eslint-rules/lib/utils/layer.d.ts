export type Layer = "domain" | "application" | "infrastructure" | "presentation" | "config" | "unknown";
export declare function detectLayer(filePath: string, projectRoot?: string): Layer;
