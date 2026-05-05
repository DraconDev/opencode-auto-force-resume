import type { Plugin } from "@opencode-ai/plugin";
import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";
import {
  type SessionState,
  type PluginConfig,
  DEFAULT_CONFIG,
  validateConfig,
  getModelContextLimit,
  getCompactionThreshold,
  PLAN_PATTERNS,
  isPlanContent,
  estimateTokens,
  formatDuration,
  createSession,
  updateProgress,
  formatMessage,
} from "./shared.js";
import { createTerminalModule } from "./terminal.js";
import { createNotificationModule } from "./notifications.js";

export const AutoForceResumePlugin: Plugin = async (input, options) => {
  let config: PluginConfig = {
    ...DEFAULT_CONFIG,
    ...(typeof options === "object" && options !== null ? options as Partial<PluginConfig> : {}),
  };
  config = validateConfig(config);

  const sessions = new Map<string, SessionState>();
  let isDisposed = false;

  function getSession(id: string): SessionState {
    if (!sessions.has(id)) {
      sessions.set(id, createSession());
    }
    return sessions.get(id)!;
  }

  function clearTimer(id: string) {
    const s = sessions.get(id);
    if (s?.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  }

  function resetSession(id: string) {
    clearTimer(id);
    const s = sessions.get(id);
    if (s) {
      s.planBuffer = '';
      s.planning = false;
      s.compacting = false;
      s.backoffAttempts = 0;
      s.autoSubmitCount = 0;
      s.lastUserMessageId = '';
      s.sentMessageAt = 0;
      s.reviewFired = false;
        if (s.reviewDebounceTimer) {
          clearTimeout(s.reviewDebounceTimer);
          s.reviewDebounceTimer = null;
        }
        resetSession(sid);
        writeStatusFile(sid);
        return;
      }
    } catch (err) {
      log('event handler error:', err);
      // Don't crash the plugin — errors in one event shouldn't break the pipeline
    }
  },
    dispose: () => {
      log('disposing plugin');
      isDisposed = true;
      sessions.forEach((s) => {
        if (s.timer) {
          clearTimeout(s.timer);
          s.timer = null;
        }
        if (s.reviewDebounceTimer) {
          clearTimeout(s.reviewDebounceTimer);
          s.reviewDebounceTimer = null;
        }
        if (s.nudgeTimer) {
          clearTimeout(s.nudgeTimer);
          s.nudgeTimer = null;
        }
        if (s.toastTimer) {
          clearInterval(s.toastTimer);
          s.toastTimer = null;
        }
      });
      sessions.clear();
    }
  };
};

