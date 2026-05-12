type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const entry = { level, message, time: new Date().toISOString(), ...fields };
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export const log = {
  info: (message: string, fields?: Record<string, unknown>): void => emit('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>): void => emit('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>): void =>
    emit('error', message, fields),
};
