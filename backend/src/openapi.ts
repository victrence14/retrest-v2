import { readFileSync } from 'node:fs';

const openApiJson: string = readFileSync(new URL('../openapi.json', import.meta.url), 'utf8');

export const openApiDocument = JSON.parse(openApiJson) as Record<string, unknown>;

export type OpenApiDocument = typeof openApiDocument;
