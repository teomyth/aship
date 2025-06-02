/**
 * Unified time formatting utilities for consistent time display across the CLI
 */

/**
 * Format date/time in local timezone with timezone information
 * Format: YYYY-MM-DD HH:mm:ss TZ
 * Example: 2025-05-31 18:43:09 CST
 */
export function formatDateTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  // Get local date/time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Get timezone abbreviation
  const timeZone = getTimezoneAbbreviation(date);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timeZone}`;
}

/**
 * Format date/time in relative format (e.g., "2 hours ago", "3 days ago")
 * Falls back to absolute format for dates older than 7 days
 */
export function formatRelativeDateTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // For very recent times (less than 1 minute)
  if (diffSeconds < 60) {
    return diffSeconds <= 5 ? 'just now' : `${diffSeconds} seconds ago`;
  }

  // For times within the last hour
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  // For times within the last day
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  // For times within the last week
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  // For older dates, use absolute format
  return formatDateTime(date);
}

/**
 * Format date only (without time)
 * Format: YYYY-MM-DD
 */
export function formatDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format time only (without date)
 * Format: HH:mm:ss TZ
 */
export function formatTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Time';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Get timezone abbreviation
  const timeZone = getTimezoneAbbreviation(date);

  return `${hours}:${minutes}:${seconds} ${timeZone}`;
}

/**
 * Get timezone abbreviation for a given date
 * This handles both standard and daylight saving time
 */
function getTimezoneAbbreviation(date: Date): string {
  try {
    // Use Intl.DateTimeFormat to get timezone information
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');

    if (timeZonePart) {
      return timeZonePart.value;
    }
  } catch (_error) {
    // Fallback if Intl.DateTimeFormat fails
  }

  // Fallback: calculate timezone offset manually
  const offset = -date.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';

  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Format duration in human-readable format
 * Example: "2h 30m", "45s", "1d 3h"
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}
