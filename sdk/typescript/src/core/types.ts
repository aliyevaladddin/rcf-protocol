export type RCFMarkerType = 'PUBLIC' | 'PROTECTED' | 'RESTRICTED' | 'NOTICE';

export interface RCFMarker {
  name: string;
  level: number | 'meta';
  description: string;
  permissions?: string[];
  restrictions?: string[];
  action?: string;
}

export interface ParsedMarker {
  type: RCFMarkerType;
  marker: RCFMarker;
  line: number;
  column: number;
  context: string;
}

export interface ParseResult {
  file: string;
  markers: ParsedMarker[];
}

export interface ValidationError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}