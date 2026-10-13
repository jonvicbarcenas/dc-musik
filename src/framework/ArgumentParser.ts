import type { ChatInputCommandInteraction } from 'discord.js';
import { parseTime } from '../lib/utils/time.js';
import { CommandError } from './errors.js';

export interface AttachmentInput {
  id: string;
  url: string;
  name: string;
  size: number;
}
export type ArgumentValue = string | number | boolean | AttachmentInput | null;
export interface ArgumentSpec {
  name: string;
  description: string;
  kind:
    | 'string'
    | 'integer'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'duration'
    | 'role'
    | 'channel'
    | 'attachment';
  required?: boolean;
  rest?: boolean;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  choices?: readonly string[];
  allowClear?: boolean;
}
export interface SubcommandSpec {
  name: string;
  description: string;
  arguments?: readonly ArgumentSpec[];
}
export interface ArgumentSchema {
  arguments?: readonly ArgumentSpec[];
  subcommands?: readonly SubcommandSpec[];
  prefixDefault?: string;
}
export class Arguments {
  constructor(
    public readonly subcommand: string | null,
    private readonly values: Readonly<Record<string, ArgumentValue>>,
  ) {}
  has(name: string): boolean {
    return Object.hasOwn(this.values, name);
  }
  text(name: string, fallback?: string): string {
    const value = this.values[name];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'string') throw invalid(name);
    return value;
  }
  optionalText(name: string): string | null {
    return this.has(name) ? this.text(name) : null;
  }
  number(name: string, fallback?: number): number {
    const value = this.values[name];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'number') throw invalid(name);
    return value;
  }
  boolean(name: string, fallback?: boolean): boolean {
    const value = this.values[name];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'boolean') throw invalid(name);
    return value;
  }
  id(name: string): string | null {
    if (!this.has(name) || this.values[name] === null) return null;
    return this.text(name);
  }
  attachment(name = 'attachment'): AttachmentInput | null {
    const value = this.values[name];
    return value && typeof value === 'object' ? value : null;
  }
  toObject(): Record<string, ArgumentValue> {
    return structuredClone(this.values);
  }
}

/** Quotes apply at token boundaries; apostrophes in words and URL backslashes are preserved. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < input.length) {
    if (/\s/.test(input[index] ?? '')) {
      index++;
      continue;
    }
    let value = '';
    const quote = input[index] === '"' || input[index] === "'" ? input[index++] : null;
    if (quote) {
      let closed = false;
      while (index < input.length) {
        const char = input[index++];
        if (char === quote) {
          closed = true;
          break;
        }
        if (char === '\\' && [quote, '\\'].includes(input[index] ?? ''))
          value += input[index++] ?? '';
        else value += char ?? '';
      }
      if (!closed || (index < input.length && !/\s/.test(input[index] ?? '')))
        throw new CommandError('ARGUMENT', 'Close quoted arguments and separate them with spaces.');
    } else {
      while (index < input.length && !/\s/.test(input[index] ?? '')) value += input[index++] ?? '';
    }
    tokens.push(value);
    if (tokens.length > 100)
      throw new CommandError('ARGUMENT', 'Too many arguments. Quote names containing spaces.');
  }
  return tokens;
}

export function parsePrefix(
  schema: ArgumentSchema,
  input: string,
  attachments: readonly AttachmentInput[] = [],
): Arguments {
  if (input.length > 6000) throw new CommandError('ARGUMENT', 'This command is too long.');
  const tokens = tokenize(input);
  let subcommand: string | null = null;
  let specs = schema.arguments ?? [];
  if (schema.subcommands?.length) {
    const requested = tokens[0]?.toLowerCase();
    const sub =
      schema.subcommands.find((candidate) => candidate.name === requested) ??
      (!requested && schema.prefixDefault
        ? schema.subcommands.find((candidate) => candidate.name === schema.prefixDefault)
        : undefined);
    if (!sub)
      throw new CommandError(
        'ARGUMENT',
        `Choose a subcommand: ${schema.subcommands.map((candidate) => candidate.name).join(', ')}.`,
      );
    if (requested) tokens.shift();
    subcommand = sub.name;
    specs = sub.arguments ?? [];
  }
  const values: Record<string, ArgumentValue> = {};
  for (const spec of specs) {
    if (spec.kind === 'attachment') {
      const attachment = attachments[0];
      if (attachment) values[spec.name] = structuredClone(attachment);
      else if (spec.required) throw invalid(spec.name);
      continue;
    }
    const raw = spec.rest && tokens.length ? tokens.splice(0).join(' ') : tokens.shift();
    if (raw === undefined) {
      if (spec.required) throw invalid(spec.name);
      continue;
    }
    values[spec.name] = parseValue(spec, raw);
  }
  if (tokens.length)
    throw new CommandError(
      'ARGUMENT',
      'Too many arguments. Quote playlist names that contain spaces.',
    );
  return new Arguments(subcommand, values);
}

export function parseInteraction(
  schema: ArgumentSchema,
  interaction: ChatInputCommandInteraction,
): Arguments {
  const subcommand = schema.subcommands?.length ? interaction.options.getSubcommand(true) : null;
  const specs = subcommand
    ? schema.subcommands?.find((sub) => sub.name === subcommand)?.arguments
    : schema.arguments;
  if (subcommand && !schema.subcommands?.some((sub) => sub.name === subcommand))
    throw new CommandError('ARGUMENT', 'This subcommand is no longer available.');
  const values: Record<string, ArgumentValue> = {};
  for (const spec of specs ?? []) {
    let raw: ArgumentValue | undefined;
    switch (spec.kind) {
      case 'integer':
        raw = interaction.options.getInteger(spec.name) ?? undefined;
        break;
      case 'number':
        raw = interaction.options.getNumber(spec.name) ?? undefined;
        break;
      case 'boolean':
        raw = interaction.options.getBoolean(spec.name) ?? undefined;
        break;
      case 'role':
        raw = interaction.options.getRole(spec.name)?.id;
        break;
      case 'channel':
        raw = interaction.options.getChannel(spec.name)?.id;
        break;
      case 'attachment': {
        const file = interaction.options.getAttachment(spec.name);
        raw = file ? { id: file.id, url: file.url, name: file.name, size: file.size } : undefined;
        break;
      }
      default:
        raw = interaction.options.getString(spec.name) ?? undefined;
    }
    if (raw === undefined) {
      if (spec.required) throw invalid(spec.name);
      continue;
    }
    values[spec.name] = spec.kind === 'attachment' ? raw : parseValue(spec, raw);
  }
  return new Arguments(subcommand, values);
}

/** Revalidate controller-provided arguments with the same schema; no UI payload is trusted. */
export function parseValues(
  schema: ArgumentSchema,
  input: Readonly<Record<string, ArgumentValue>>,
  subcommand: string | null = null,
): Arguments {
  const specs = subcommand
    ? schema.subcommands?.find((sub) => sub.name === subcommand)?.arguments
    : schema.arguments;
  if (schema.subcommands?.length && !schema.subcommands.some((sub) => sub.name === subcommand))
    throw new CommandError('ARGUMENT', 'Choose a valid subcommand.');
  const known = new Set((specs ?? []).map((spec) => spec.name));
  if (Object.keys(input).some((name) => !known.has(name)))
    throw new CommandError('ARGUMENT', 'Unexpected command arguments.');
  const values: Record<string, ArgumentValue> = {};
  for (const spec of specs ?? []) {
    const raw = input[spec.name];
    if (raw === undefined) {
      if (spec.required) throw invalid(spec.name);
      continue;
    }
    if (spec.kind === 'attachment')
      throw new CommandError('ARGUMENT', 'Upload files through a command message.');
    values[spec.name] = parseValue(spec, raw);
  }
  return new Arguments(subcommand, values);
}

function parseValue(spec: ArgumentSpec, input: ArgumentValue): ArgumentValue {
  if (
    spec.allowClear &&
    (input === null || (typeof input === 'string' && /^(?:off|none|clear)$/i.test(input)))
  )
    return null;
  if (spec.kind === 'boolean') {
    if (typeof input === 'boolean') return input;
    if (typeof input !== 'string') throw invalid(spec.name);
    if (/^(?:on|true|yes|enabled?|1)$/i.test(input)) return true;
    if (/^(?:off|false|no|disabled?|0)$/i.test(input)) return false;
    throw new CommandError('ARGUMENT', `Use on or off for ${spec.name}.`);
  }
  if (spec.kind === 'integer' || spec.kind === 'number') {
    if (
      typeof input !== 'number' &&
      (typeof input !== 'string' ||
        !(spec.kind === 'integer' ? /^-?\d+$/ : /^-?(?:\d+(?:\.\d*)?|\.\d+)$/).test(input))
    )
      throw invalid(spec.name);
    const value = Number(input);
    if (
      !Number.isFinite(value) ||
      (spec.kind === 'integer' && !Number.isSafeInteger(value)) ||
      (spec.minimum !== undefined && value < spec.minimum) ||
      (spec.maximum !== undefined && value > spec.maximum)
    )
      throw new CommandError(
        'ARGUMENT',
        `${spec.name} must be ${spec.kind === 'integer' ? 'a whole number' : 'a number'}${spec.minimum !== undefined ? ` from ${spec.minimum}` : ''}${spec.maximum !== undefined ? ` to ${spec.maximum}` : ''}.`,
      );
    return value;
  }
  if (typeof input !== 'string') throw invalid(spec.name);
  const value = input.trim();
  if (
    !value ||
    value.length > (spec.maxLength ?? 4096) ||
    [...value].some((char) => {
      const point = char.codePointAt(0) ?? 0;
      return point < 32 || point === 127;
    })
  )
    throw invalid(spec.name);
  if (spec.kind === 'duration') {
    const milliseconds = parseTime(value);
    if (
      (spec.minimum !== undefined && milliseconds < spec.minimum) ||
      (spec.maximum !== undefined && milliseconds > spec.maximum)
    )
      throw invalid(spec.name);
    return milliseconds;
  }
  if (spec.kind === 'enum') {
    const selected = value.toLowerCase();
    if (!spec.choices?.includes(selected))
      throw new CommandError(
        'ARGUMENT',
        `Choose ${spec.choices?.join(', ') ?? 'a valid value'} for ${spec.name}.`,
      );
    return selected;
  }
  if (spec.kind === 'role' || spec.kind === 'channel') {
    const id = value.replace(spec.kind === 'role' ? /^<@&(\d+)>$/ : /^<#(\d+)>$/, '$1');
    if (!/^\d{17,20}$/.test(id))
      throw new CommandError('ARGUMENT', `Mention a ${spec.kind} or provide its ID.`);
    return id;
  }
  return value;
}
function invalid(name: string): CommandError {
  return new CommandError('ARGUMENT', `Provide a valid ${name.replace(/-/g, ' ')}.`);
}
