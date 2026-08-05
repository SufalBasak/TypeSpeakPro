export type MetricRecord = {
  id?: string | number | null;
  session_id?: string | null;
  user_id?: string | null;
  wpm?: number | null;
  accuracy?: number | null;
  score?: number | null;
  time_duration?: number | null;
  duration?: number | null;
  mode?: string | null;
  practice_type?: string | null;
  created_at?: string | null;
};

const MAX_WPM = 400;
const MAX_SCORE = 10000;

export const createAnalyticsSessionId = () =>
  globalThis.crypto?.randomUUID?.() ?? `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const roundMetric = (value: number) => (Number.isFinite(value) ? Math.round(value) : 0);

export const clampPercent = (value: number) => Math.min(100, Math.max(0, roundMetric(value)));

export const calculateWpm = (charCount: number, durationSeconds: number) => {
  if (!Number.isFinite(charCount) || !Number.isFinite(durationSeconds) || charCount <= 0 || durationSeconds <= 0) {
    return 0;
  }
  return roundMetric((charCount / 5 / durationSeconds) * 60);
};

export const calculateAccuracy = (typed: string, target: string) => {
  if (!typed.length) return 100;
  let correct = 0;
  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === target[i]) correct += 1;
  }
  return clampPercent((correct / typed.length) * 100);
};

export const calculatePercent = (value: number, total: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return clampPercent((value / total) * 100);
};

export const sanitizeMetricRecord = <T extends MetricRecord>(record: T): T | null => {
  const wpm = record.wpm === null ? undefined : roundMetric(Number(record.wpm));
  const rawAccuracy = record.accuracy == null ? undefined : Number(record.accuracy);
  const accuracy = rawAccuracy == null ? undefined : roundMetric(rawAccuracy);
  const score = record.score == null ? undefined : roundMetric(Number(record.score));
  const duration = record.time_duration ?? record.duration;

  if (wpm !== undefined && (wpm < 0 || wpm > MAX_WPM)) return null;
  if (accuracy !== undefined && (accuracy < 0 || accuracy > 100)) return null;
  if (score !== undefined && (score < 0 || score > MAX_SCORE)) return null;
  if (duration != null && (!Number.isFinite(Number(duration)) || Number(duration) < 0)) return null;

  return {
    ...record,
    ...(wpm !== undefined ? { wpm } : {}),
    ...(accuracy !== undefined ? { accuracy } : {}),
    ...(score !== undefined ? { score } : {}),
  };
};

export const metricRecordKey = (record: MetricRecord) =>
  String(
    record.session_id ??
      record.id ??
      [
        record.user_id ?? '',
        record.created_at ?? '',
        record.mode ?? record.practice_type ?? '',
        record.time_duration ?? record.duration ?? '',
        record.wpm ?? '',
        record.accuracy ?? '',
        record.score ?? '',
      ].join('|'),
  );

export const dedupeMetricRecords = <T extends MetricRecord>(records: T[]) => {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const record of records) {
    const sanitized = sanitizeMetricRecord(record);
    if (!sanitized) continue;

    const key = metricRecordKey(sanitized);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(sanitized);
  }

  return deduped;
};

export const averageMetric = (values: Array<number | null | undefined>) => {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return roundMetric(valid.reduce((sum, value) => sum + value, 0) / valid.length);
};

export const chooseBestTypingRecord = <T extends MetricRecord>(records: T[]) =>
  dedupeMetricRecords(records).sort((a, b) => {
    if ((b.wpm ?? 0) !== (a.wpm ?? 0)) return (b.wpm ?? 0) - (a.wpm ?? 0);
    if ((b.accuracy ?? 0) !== (a.accuracy ?? 0)) return (b.accuracy ?? 0) - (a.accuracy ?? 0);
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  })[0];

export const aggregateTypingRecords = (records: MetricRecord[]) => {
  const valid = dedupeMetricRecords(records);
  return {
    totalTests: valid.length,
    avgWpm: averageMetric(valid.map((record) => record.wpm)),
    avgAccuracy: averageMetric(valid.map((record) => record.accuracy)),
    totalTimeSeconds: valid.reduce((sum, record) => sum + roundMetric(Number(record.time_duration ?? 0)), 0),
    bestWpm: chooseBestTypingRecord(valid)?.wpm ?? 0,
    records: valid,
  };
};

export const aggregatePracticeRecords = (records: MetricRecord[]) => {
  const valid = dedupeMetricRecords(records);
  const byType = (type: string) => valid.filter((record) => record.practice_type === type);
  const voice = byType('listening');
  const verbal = byType('verbal');

  return {
    voicePoints: voice.reduce((sum, record) => sum + roundMetric(Number(record.score ?? 0)), 0),
    voiceAccuracy: averageMetric(voice.map((record) => record.accuracy)),
    verbalPoints: verbal.reduce((sum, record) => sum + roundMetric(Number(record.score ?? 0)), 0),
    verbalAccuracy: averageMetric(verbal.map((record) => record.accuracy)),
  };
};

export const rankBestTypingRecords = <T extends MetricRecord>(records: T[]) => {
  const byUser = new Map<string, T>();

  for (const record of dedupeMetricRecords(records)) {
    if (!record.user_id) continue;
    const current = byUser.get(record.user_id);
    const best = chooseBestTypingRecord(current ? [current, record] : [record]);
    if (best) byUser.set(record.user_id, best as T);
  }

  return Array.from(byUser.values()).sort((a, b) => {
    if ((b.wpm ?? 0) !== (a.wpm ?? 0)) return (b.wpm ?? 0) - (a.wpm ?? 0);
    return (b.accuracy ?? 0) - (a.accuracy ?? 0);
  });
};
