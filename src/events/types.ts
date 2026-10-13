import type { LavalinkManager } from 'lavalink-client';
import type { CommandServices } from '../framework/CommandServices.js';
import type { CommandHandler } from '../framework/CommandHandler.js';
import type { InteractionRouter } from '../framework/InteractionRouter.js';
import type { CommandPresenter } from '../lib/ui/CommandPresenter.js';
import type { RecoveryManager } from '../lib/music/RecoveryManager.js';
import type { TaskGroup } from '../lib/runtime/TaskGroup.js';
import type { MultiBotCoordinator } from '../lib/advanced/MultiBotCoordinator.js';

export interface BotEvents {
  services: CommandServices;
  handler: CommandHandler;
  router: InteractionRouter;
  ui: CommandPresenter;
  lavalink: LavalinkManager;
  recovery: RecoveryManager;
  tasks: TaskGroup;
  coordinator: MultiBotCoordinator;
  preparedNodes: Set<string>;
}
