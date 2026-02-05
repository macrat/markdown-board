#!/usr/bin/env node

/**
 * Cleanup script for archived pages older than 30 days
 * This can be run as a cron job or scheduled task
 */

async function cleanupOldArchives() {
  try {
    const response = await fetch('http://localhost:3000/api/archives', {
      method: 'DELETE',
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✓ Cleaned up ${result.deleted} archived pages older than 30 days`);
    } else {
      console.error('✗ Failed to clean up archives:', response.statusText);
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error cleaning up archives:', error);
    process.exit(1);
  }
}

cleanupOldArchives();
