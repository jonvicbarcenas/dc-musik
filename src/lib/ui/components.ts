import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import type { InteractionSessionHandle } from '../../framework/InteractionRouter.js';
import type { CommandCategory } from '../../framework/Command.js';
import type { QueueSnapshot } from '../db/models.js';
import type { Language } from '../utils/i18n.js';
import { translate as t } from '../utils/i18n.js';

export function controllerButtons(
  session: InteractionSessionHandle,
  snapshot: QueueSnapshot,
  language: Language,
) {
  const button = (action: string, emoji: string, label: string, style = ButtonStyle.Secondary) =>
    new ButtonBuilder()
      .setCustomId(session.id(action))
      .setEmoji(emoji)
      .setLabel(label)
      .setStyle(style);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button('previous', '⏮️', t(language, 'previous')),
      button(
        'pause',
        snapshot.paused ? '▶️' : '⏸️',
        t(language, snapshot.paused ? 'resume' : 'pause'),
        ButtonStyle.Primary,
      ),
      button('skip', '⏭️', t(language, 'skip')),
      button('stop', '⏹️', t(language, 'stop'), ButtonStyle.Danger),
      button('shuffle', '🔀', t(language, 'shuffle')),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button('loop', '🔁', t(language, 'loop')),
      button('quieter', '🔉', '−10%'),
      button('louder', '🔊', '+10%'),
      button('queue', '📜', t(language, 'queue')),
      button('favorite', '❤️', t(language, 'favorite')),
    ),
  ];
}
export function pageButtons(session: InteractionSessionHandle, page: number, pages: number) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(session.id('back'))
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(session.id('next'))
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pages),
    ),
  ];
}
export function helpMenu(
  session: InteractionSessionHandle,
  categories: readonly CommandCategory[],
  selected: CommandCategory,
  language: Language,
) {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(session.id('category'))
        .setPlaceholder(t(language, 'help'))
        .addOptions(
          categories.map((category) => ({
            label: t(language, category),
            value: category,
            default: category === selected,
          })),
        ),
    ),
  ];
}
