const SESSION_CAPTURE_PATTERNS = [
  /(20\d{2})-(\d{2})-(\d{2})[_ T](\d{2})-(\d{2})-(\d{2})/,
  /(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/
];

export function extractSessionCapture(label: string | null | undefined) {
  if (!label) {
    return { captured_at_local: null, source_session_label: null };
  }

  const normalized = label.replace(/\.[a-z0-9]+$/i, "");
  for (const pattern of SESSION_CAPTURE_PATTERNS) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const [, year, month, day, hour, minute, second] = match;
    return {
      captured_at_local: `${year}-${month}-${day}T${hour}:${minute}:${second}`,
      source_session_label: normalized
    };
  }

  return {
    captured_at_local: null,
    source_session_label: normalized || null
  };
}
