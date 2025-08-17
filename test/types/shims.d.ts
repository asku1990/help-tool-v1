// Ambient shims to avoid TS errors when dev deps are not installed locally
declare module 'msw' {
  export const http: any;
  export const HttpResponse: any;
}

declare module 'msw/node' {
  export const setupServer: any;
}

declare module '@faker-js/faker' {
  export const faker: any;
}

declare module '@testcontainers/postgresql' {
  export const PostgreSqlContainer: any;
  export type StartedPostgreSqlContainer = any;
}

declare module 'execa' {
  export const execa: any;
}

declare module '@playwright/test' {
  export const defineConfig: any;
  export const test: any;
  export const expect: any;
}
