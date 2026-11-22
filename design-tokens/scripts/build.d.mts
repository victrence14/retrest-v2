export interface Token {
  value: string | number;
  type?: string;
}

export interface TokenGroup {
  [name: string]: Token | TokenGroup;
}

export interface TokenDocument {
  global: TokenGroup;
  light: TokenGroup;
  dark: TokenGroup;
}

export function flatten(group: TokenGroup, prefix?: string, output?: Record<string, string | number>): Record<string, string | number>;
export function resolve(value: string | number, tokens: Record<string, string | number>, chain?: string[]): string;
export function generateCss(document: TokenDocument): string;
