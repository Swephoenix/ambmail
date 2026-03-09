import { defineConfig } from '@prisma/config';

// For Prisma 7, we need to handle both build-time and runtime config
// The datasource URL can come from environment or be undefined for schema validation
const getDatabaseUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  // Return a placeholder for schema validation during build
  return 'postgresql://placeholder:for-build@localhost:5432/placeholder';
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: getDatabaseUrl(),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
