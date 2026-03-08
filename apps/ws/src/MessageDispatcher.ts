/**
 * Message Dispatcher
 * 
 * Dispatches messages to appropriate clients based on channel subscriptions
 * Supports both local broadcast and Redis pub/sub for multi-instance deployment
 */

import { WebSocket } from "ws";
import type { ServerMessage } from "@hyperx/types/websocket";
import { getSubscriptionManager, type ClientInfo } from "./SubscriptionManager.js";
import { publishMessage, isPubSubEnabled } from "./pubsub.js";

interface DispatchOptions {
  channel: string;
  market?: string;
  data: ServerMessage;
  excludeClient?: string; // Client ID to exclude
}

interface BroadcastResult {
  sent: number;
  failed: number;
}

class MessageDispatcher {
  private subscriptionManager = getSubscriptionManager();

  /**
   * Dispatch a message to all subscribers of a channel
   */
  dispatch(options: DispatchOptions): BroadcastResult {
    const { channel, market, data, excludeClient } = options;
    const channelKey = market ? `${channel}:${market}` : channel;

    // Get all subscribers
    const subscribers = this.subscriptionManager.getChannelSubscribers(channelKey);

    let sent = 0;
    let failed = 0;
    const message = JSON.stringify(data);

    for (const client of subscribers) {
      // Skip excluded client
      if (excludeClient && client.id === excludeClient) continue;

      // Skip dead connections
      if (!client.isAlive) {
        failed++;
        continue;
      }

      // Send message
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sent++;
        } catch (error) {
          console.error(`Failed to send to client ${client.id}:`, error);
          failed++;
        }
      } else {
        failed++;
      }
    }

    // Publish to Redis for multi-instance support
    if (isPubSubEnabled()) {
      publishMessage({
        channel,
        market,
        data,
      });
    }

    return { sent, failed };
  }

  /**
   * Dispatch message to a specific user (auth-gated channel)
   */
  dispatchToUser(userId: string, data: ServerMessage): BroadcastResult {
    const clients = this.subscriptionManager.getUserClients(userId);

    let sent = 0;
    let failed = 0;
    const message = JSON.stringify(data);

    for (const client of clients) {
      // Check if client is subscribed to account channel
      if (!client.subscriptions.has(`account:${userId}`)) continue;

      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sent++;
        } catch (error) {
          console.error(`Failed to send to user client ${client.id}:`, error);
          failed++;
        }
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Dispatch to specific client
   */
  dispatchToClient(clientId: string, data: ServerMessage): boolean {
    const client = this.subscriptionManager.getClient(clientId);
    if (!client) return false;

    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
        return false;
      }
    }

    return false;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(data: ServerMessage): BroadcastResult {
    const clients = this.subscriptionManager.getAllClients();

    let sent = 0;
    let failed = 0;
    const message = JSON.stringify(data);

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sent++;
        } catch (error) {
          console.error(`Failed to broadcast to client ${client.id}:`, error);
          failed++;
        }
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Handle incoming Redis pub/sub message
   */
  handlePubSubMessage(message: {
    channel: string;
    market?: string;
    data: ServerMessage;
  }): void {
    const channelKey = message.market
      ? `${message.channel}:${message.market}`
      : message.channel;

    // Get all local subscribers
    const subscribers = this.subscriptionManager.getChannelSubscribers(channelKey);

    const dataStr = JSON.stringify(message.data);

    for (const client of subscribers) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(dataStr);
        } catch (error) {
          console.error(`Failed to send pub/sub message to client ${client.id}:`, error);
        }
      }
    }
  }
}

// Singleton instance
let messageDispatcher: MessageDispatcher | null = null;

export function getMessageDispatcher(): MessageDispatcher {
  if (!messageDispatcher) {
    messageDispatcher = new MessageDispatcher();
  }
  return messageDispatcher;
}

export function resetMessageDispatcher(): void {
  messageDispatcher = null;
}

export type { DispatchOptions, BroadcastResult };
