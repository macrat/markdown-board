#!/usr/bin/env -S npx tsx

/**
 * Cleanup script for archived pages older than 30 days
 * This can be run as a cron job or scheduled task
 *
 * @env {string} API_URL - Base URL of the API server (default: http://localhost:3000)
 *
 * @example
 * # Run with default URL
 * npx tsx cleanup-archives.ts
 *
 * # Run with custom URL
 * API_URL=https://api.example.com npx tsx cleanup-archives.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function cleanupOldArchives() {
  console.log(`Connecting to API at ${API_URL}...`);

  try {
    const response = await fetch(`${API_URL}/api/archives`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      console.error(
        `Failed to clean up archives: ${response.status} ${response.statusText}`,
      );
      process.exit(1);
    }

    const result = (await response.json()) as { deleted: number };
    console.log(
      `Cleaned up ${result.deleted} archived pages older than 30 days`,
    );
  } catch (error) {
    console.error('Error cleaning up archives:', error);
    process.exit(1);
  }
}

cleanupOldArchives();
