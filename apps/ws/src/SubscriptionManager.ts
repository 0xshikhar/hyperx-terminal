/**
 * Subscription Manager
 * 
 * Manages WebSocket client subscriptions with support for:
 * - Public channels (ticker, orderbook, trades, candles, status)
 * - Private/Auth-gated channels (account:{userId})
 * - Efficient channel-to-clients mapping
 */

import type { WebSocket } from "ws";

type ClientId = string;
type ChannelKey = string;

export interface ClientInfo {
  id: ClientId;
  ws: WebSocket;
  userId?: string; // Set if authenticated
  subscriptions: Set<ChannelKey>;
  lastPing: number;
  isAlive: boolean;
  connectedAt: number;
}

export interface SubscriptionMetrics {
  totalClients: number;
  totalSubscriptions: number;
  channels: Map<ChannelKey, number>;
}

class SubscriptionManager {
  private clients = new Map<ClientId, ClientInfo>();
  private channelToClients = new Map<ChannelKey, Set<ClientId>>();
  private userToClients = new Map<string, Set<ClientId>>();

  /**
   * Register a new client
   */
  registerClient(id: ClientId, ws: WebSocket, userId?: string): ClientInfo {
    const client: ClientInfo = {
      id,
      ws,
      userId,
      subscriptions: new Set(),
      lastPing: Date.now(),
      isAlive: true,
      connectedAt: Date.now(),
    };

    this.clients.set(id, client);

    // Track user-to-clients mapping for auth-gated channels
    if (userId) {
      if (!this.userToClients.has(userId)) {
        this.userToClients.set(userId, new Set());
      }
      this.userToClients.get(userId)!.add(id);
    }

    return client;
  }

  /**
   * Remove a client and clean up subscriptions
   */
  removeClient(id: ClientId): void {
    const client = this.clients.get(id);
    if (!client) return;

    // Remove from all channels
    for (const channel of client.subscriptions) {
      this.removeFromChannel(id, channel);
    }

    // Remove from user mapping
    if (client.userId) {
      const userClients = this.userToClients.get(client.userId);
      if (userClients) {
        userClients.delete(id);
        if (userClients.size === 0) {
          this.userToClients.delete(client.userId);
        }
      }
    }

    this.clients.delete(id);
  }

  /**
   * Subscribe a client to a channel
   */
  subscribe(clientId: ClientId, channel: ChannelKey, requireAuth = false): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Check auth requirement for private channels
    if (requireAuth && !client.userId) {
      return false;
    }

    // Add to client's subscriptions
    client.subscriptions.add(channel);

    // Add to channel mapping
    if (!this.channelToClients.has(channel)) {
      this.channelToClients.set(channel, new Set());
    }
    this.channelToClients.get(channel)!.add(clientId);

    return true;
  }

  /**
   * Unsubscribe a client from a channel
   */
  unsubscribe(clientId: ClientId, channel: ChannelKey): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Remove from client's subscriptions
    client.subscriptions.delete(channel);

    // Remove from channel mapping
    this.removeFromChannel(clientId, channel);

    return true;
  }

  /**
   * Remove client from channel mapping
   */
  private removeFromChannel(clientId: ClientId, channel: ChannelKey): void {
    const channelClients = this.channelToClients.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
      if (channelClients.size === 0) {
        this.channelToClients.delete(channel);
      }
    }
  }

  /**
   * Get all clients subscribed to a channel
   */
  getChannelSubscribers(channel: ChannelKey): ClientInfo[] {
    const clientIds = this.channelToClients.get(channel);
    if (!clientIds) return [];

    return Array.from(clientIds)
      .map((id) => this.clients.get(id))
      .filter((client): client is ClientInfo => client !== undefined);
  }

  /**
   * Get all clients for a user (for auth-gated channels)
   */
  getUserClients(userId: string): ClientInfo[] {
    const clientIds = this.userToClients.get(userId);
    if (!clientIds) return [];

    return Array.from(clientIds)
      .map((id) => this.clients.get(id))
      .filter((client): client is ClientInfo => client !== undefined);
  }

  /**
   * Update client authentication
   */
  setClientAuth(clientId: ClientId, userId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from old user mapping if exists
    if (client.userId) {
      const oldUserClients = this.userToClients.get(client.userId);
      if (oldUserClients) {
        oldUserClients.delete(clientId);
      }
    }

    // Set new userId
    client.userId = userId;

    // Add to new user mapping
    if (!this.userToClients.has(userId)) {
      this.userToClients.set(userId, new Set());
    }
    this.userToClients.get(userId)!.add(clientId);
  }

  /**
   * Get client by ID
   */
  getClient(id: ClientId): ClientInfo | undefined {
    return this.clients.get(id);
  }

  /**
   * Get all connected clients
   */
  getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get metrics
   */
  getMetrics(): SubscriptionMetrics {
    const channels = new Map<ChannelKey, number>();
    for (const [channel, clients] of this.channelToClients.entries()) {
      channels.set(channel, clients.size);
    }

    return {
      totalClients: this.clients.size,
      totalSubscriptions: Array.from(this.clients.values()).reduce(
        (sum, client) => sum + client.subscriptions.size,
        0
      ),
      channels,
    };
  }

  /**
   * Update client ping time
   */
  updatePing(clientId: ClientId): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
      client.isAlive = true;
    }
  }

  /**
   * Mark client as disconnected
   */
  markDead(clientId: ClientId): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = false;
    }
  }

  /**
   * Clean up stale clients
   */
  cleanupStaleClients(maxAge: number): ClientId[] {
    const now = Date.now();
    const stale: ClientId[] = [];

    for (const [id, client] of this.clients.entries()) {
      if (now - client.lastPing > maxAge) {
        stale.push(id);
      }
    }

    for (const id of stale) {
      this.removeClient(id);
    }

    return stale;
  }
}

// Singleton instance
let subscriptionManager: SubscriptionManager | null = null;

export function getSubscriptionManager(): SubscriptionManager {
  if (!subscriptionManager) {
    subscriptionManager = new SubscriptionManager();
  }
  return subscriptionManager;
}

export function resetSubscriptionManager(): void {
  subscriptionManager = null;
}
