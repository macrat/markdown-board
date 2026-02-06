#!/usr/bin/env node

/**
 * Cleanup script for archived pages older than 30 days
 * This can be run as a cron job or scheduled task
 *
 * @env {string} API_URL - Base URL of the API server (default: http://localhost:3000)
 *
 * @example
 * # Run with default URL
 * node cleanup-archives.js
 *
 * # Run with custom URL
 * API_URL=https://api.example.com node cleanup-archives.js
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

    const result = await response.json();
    console.log(
      `Cleaned up ${result.deleted} archived pages older than 30 days`,
    );
  } catch (error) {
    console.error('Error cleaning up archives:', error.message || error);
    process.exit(1);
  }
}

cleanupOldArchives();
