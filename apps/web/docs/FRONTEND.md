# HyperX Terminal - Frontend Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [New Features & Improvements](#new-features--improvements)
4. [Component Library](#component-library)
5. [Authentication System](#authentication-system)
6. [Theming System](#theming-system)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Command Palette](#command-palette)
9. [Toast Notifications](#toast-notifications)
10. [Loading States](#loading-states)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Overview

HyperX Terminal is a modern, professional perpetual futures trading platform built for Starknet. The frontend has been completely revamped with a cyberpunk terminal aesthetic, featuring:

- **Modern Terminal UI**: Dark theme with cyan accents, monospace fonts, glowing effects
- **JWT Authentication**: Secure Starknet wallet-based authentication
- **Command Palette**: Quick access to all features via keyboard
- **Keyboard Shortcuts**: Power-user productivity features
- **Animated UI**: Smooth transitions and micro-interactions
- **Responsive Design**: Works on desktop, tablet, and mobile

---

## Architecture

### Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Server State**: TanStack Query
- **Animations**: Framer Motion
- **UI Components**: shadcn/ui + Radix UI
- **Wallet**: @starknet-io/get-starknet + starknet.js

### Directory Structure

```
apps/web/src/
├── components/
│   ├── ui/                    # shadcn/ui base components
│   ├── command-palette/       # Command palette feature
│   ├── keyboard-shortcuts/    # Keyboard shortcuts help
│   ├── skeletons/             # Loading skeletons
│   ├── theme/                 # Theme toggle components
│   ├── toast/                 # Toast notification system
│   └── ...
├── hooks/
│   ├── useKeyboardShortcuts.tsx
│   ├── useTheme.ts
│   └── ...
├── services/
│   ├── auth.service.ts        # JWT authentication
│   ├── apiClient/
│   └── wsClient/
├── store/
│   └── uiStore.ts             # Theme, preferences
└── styles/
    └── globals.css            # Terminal theme CSS
```

---

## New Features & Improvements

### 1. JWT Authentication System

**Files:**
- `src/services/auth.service.ts`
- `src/pages/LoginPage.tsx`

**Features:**
- Starknet wallet signature authentication
- Secure JWT token storage
- Automatic token refresh
- 3-step authentication flow (Connect → Sign → Access)
- Typed data signing following SNIP-12 standard

**Usage:**
```typescript
import { signInWithWallet, isAuthenticated, logout } from "@/services/auth.service";

// Authenticate
await signInWithWallet();

// Check auth status
if (isAuthenticated()) {
  // User is logged in
}

// Logout
await logout();
```

### 2. Command Palette

**File:** `src/components/command-palette/CommandPalette.tsx`

**Features:**
- Quick navigation to any page
- Theme switching
- Wallet connection
- Keyboard shortcut display
- Fuzzy search

**Keyboard Shortcut:** `Ctrl+K` / `Cmd+K`

**Commands Available:**
- Navigation: Go to Terminal, Markets, Portfolio, Leaderboard
- Preferences: Toggle Theme
- Actions: Open Notifications, View Shortcuts
- Wallet: Connect, Disconnect

### 3. Keyboard Shortcuts

**Files:**
- `src/hooks/useKeyboardShortcuts.tsx`
- `src/components/keyboard-shortcuts/KeyboardShortcutsHelp.tsx`

**Features:**
- Global keyboard event handling
- Context-aware shortcuts
- Visual help overlay
- Custom shortcut registration

**Default Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open Command Palette |
| `Ctrl+T` | Toggle Theme |
| `Ctrl+N` | Notifications |
| `?` | Show Keyboard Help |
| `G T` | Go to Terminal |
| `G M` | Go to Markets |
| `G P` | Go to Portfolio |
| `G L` | Go to Leaderboard |

### 4. Modern Terminal Theme

**File:** `src/styles/globals.css`

**Design System:**
- **Background**: `#0a0a0f` (near-black)
- **Primary**: `#22d3ee` (cyan)
- **Success**: `#34d399` (green)
- **Error**: `#f87171` (red)
- **Warning**: `#fbbf24` (yellow)

**Effects:**
- Scanlines overlay
- Grid lines background
- Glowing borders and text
- Neon accent colors
- Vignette overlay
- Smooth transitions

### 5. Theme Toggle

**File:** `src/components/theme/ThemeToggle.tsx`

**Features:**
- Three theme modes: Light, Dark, System
- Animated transitions
- Keyboard shortcut support (`Ctrl+T`)
- Persistent storage

**Components:**
- `ThemeToggle` - Segmented control
- `ThemeToggleSwitch` - Switch style
- `ThemeToggleAnimated` - Icon animation

### 6. Toast Notifications

**File:** `src/components/toast/Toast.tsx`

**Features:**
- 4 types: Success, Error, Info, Warning
- Progress bar with auto-dismiss
- Swipe to dismiss
- Stackable notifications
- Terminal-styled design

**Usage:**
```typescript
import { toast } from "@/components/toast/Toast";

toast.success("Order placed successfully!");
toast.error("Transaction failed", "Insufficient balance");
toast.info("New feature available");
toast.warning("High slippage detected");
```

### 7. Loading Skeletons

**File:** `src/components/skeletons/Skeletons.tsx`

**Components:**
- `Skeleton` - Base skeleton
- `TableSkeleton` - Table loading state
- `CardSkeleton` - Card loading state
- `ChartSkeleton` - Chart loading state
- `OrderBookSkeleton` - Orderbook loading state
- `TradeFormSkeleton` - Trade form loading state
- `StatsSkeleton` - Stats grid loading state
- `PageLoading` - Full page loading

**Usage:**
```typescript
import { Skeleton, TableSkeleton } from "@/components/skeletons/Skeletons";

// Simple skeleton
<Skeleton className="h-4 w-24" />

// Table skeleton
<TableSkeleton rows={5} columns={4} />
```

---

## Component Library

### Terminal Panel

```typescript
<div className="terminal-panel">
  <div className="terminal-header">
    <span>Panel Title</span>
  </div>
  <div className="p-4">
    Content here
  </div>
</div>
```

### Price Display

```typescript
// Price up (green)
<span className="price-up">$42,500.00</span>

// Price down (red)
<span className="price-down">$42,300.00</span>
```

### Status Indicator

```typescript
// Active
<div className="status-dot active" />

// Inactive
<div className="status-dot inactive" />
```

### Terminal Button

```typescript
// Primary
<button className="btn-terminal-primary">Submit</button>

// Secondary
<button className="btn-terminal">Cancel</button>
```

### Terminal Input

```typescript
<input className="input-terminal" placeholder="Enter amount..." />
```

---

## Authentication System

### Flow

1. **User visits `/login`**
2. **Step 1: Connect Wallet**
   - Opens Starknet wallet selector
   - User selects wallet (Argent, Braavos, etc.)
   - Wallet connects via `get-starknet`

3. **Step 2: Sign Message**
   - Frontend requests nonce from `/auth/nonce`
   - User signs typed data with wallet
   - Signature includes nonce, timestamp, wallet address

4. **Step 3: Verify & Get JWT**
   - Frontend sends signature to `/auth/verify`
   - Backend verifies ECDSA signature using starknet.js
   - Backend issues JWT token
   - Token stored in localStorage

5. **Authenticated Access**
   - JWT sent with every API request
   - WebSocket connects with token
   - Private channels accessible

### API Integration

All API requests automatically include JWT:
```typescript
// Automatically adds: Authorization: Bearer <token>
const response = await apiClient.get("/api/positions");
```

WebSocket automatically includes token:
```typescript
// Connects to: ws://localhost:3002?token=<token>
wsClient.connect();
```

---

## Theming System

### Theme Configuration

**Store:** `src/store/uiStore.ts`

```typescript
type Theme = "light" | "dark" | "system";

const { theme, setTheme, toggleTheme } = useUIStore();
```

### CSS Variables

```css
:root {
  --background: #0a0a0f;
  --foreground: #e4e4e7;
  --primary: #22d3ee;
  --terminal-green: #34d399;
  --terminal-red: #f87171;
  /* ... */
}
```

### Custom Utilities

```css
/* Terminal panel */
.terminal-panel { }

/* Price colors */
.price-up { }
.price-down { }

/* Status indicators */
.status-dot { }

/* Glowing effects */
.glow-border { }
.text-glow-cyan { }
```

---

## Keyboard Shortcuts

### Registering Custom Shortcuts

```typescript
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

function MyComponent() {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    registerShortcut({
      key: "b",
      description: "Focus buy side",
      action: () => setSide("buy"),
      scope: "terminal",
    });

    return () => unregisterShortcut("b");
  }, []);
}
```

### Shortcut Scopes

- `global` - Works everywhere
- `terminal` - Only in trading terminal
- `chart` - Only when chart is focused

---

## Command Palette

### Adding Commands

```typescript
// In CommandPalette.tsx
const commands: CommandItem[] = [
  {
    id: "my-command",
    label: "My Custom Command",
    icon: <MyIcon className="h-4 w-4" />,
    shortcut: "Ctrl+M",
    action: () => {
      // Your action
    },
    keywords: ["custom", "action"],
    category: "Custom",
  },
];
```

---

## Toast Notifications

### Configuration

```typescript
// Default duration: 5000ms
toast.success("Title", "Optional message", duration);
```

### Positions

- `top-right` (default)
- `top-left`
- `bottom-right`
- `bottom-left`
- `top-center`
- `bottom-center`

---

## Loading States

### Best Practices

1. **Use skeletons for content** that takes >300ms to load
2. **Show immediate feedback** on user actions
3. **Avoid layout shift** by using consistent skeleton sizes
4. **Progressive loading** - show skeletons while fetching

### Examples

```typescript
// Table loading
{isLoading ? (
  <TableSkeleton rows={10} columns={5} />
) : (
  <DataTable data={data} />
)}

// Card loading
{isLoading ? (
  <CardSkeleton hasHeader lines={4} />
) : (
  <MarketCard data={market} />
)}
```

---

## Best Practices

### 1. Performance

- Use `React.memo` for expensive components
- Lazy load routes with `React.lazy()`
- Use `useMemo` for expensive calculations
- Debounce rapid user inputs

### 2. Accessibility

- Use semantic HTML
- Include `aria-labels` on interactive elements
- Ensure keyboard navigation works
- Test with screen readers

### 3. Error Handling

```typescript
try {
  await someOperation();
} catch (error) {
  toast.error("Operation failed", error.message);
  console.error("Operation failed:", error);
}
```

### 4. Type Safety

- Always use TypeScript
- Define interfaces for all data structures
- Use strict mode
- Avoid `any` type

---

## Troubleshooting

### JWT Authentication Issues

**Problem**: "Authentication failed" error
- **Solution**: Check JWT_SECRET is set in API .env
- Check wallet is connected
- Verify signature in browser console

**Problem**: "Invalid signature"
- **Solution**: Clear localStorage and reconnect wallet
- Check Starknet network (mainnet vs testnet)

### Build Errors

**Problem**: TypeScript errors
- **Solution**: Run `pnpm type-check`
- Check for missing imports
- Verify component props

**Problem**: CSS not loading
- **Solution**: Check globals.css is imported
- Verify Tailwind config

### WebSocket Issues

**Problem**: Connection refused
- **Solution**: Check WS server is running on correct port
- Verify JWT token is valid
- Check firewall settings

### Performance Issues

**Problem**: Slow initial load
- **Solution**: Implement code splitting
- Lazy load heavy components
- Use React DevTools Profiler

---

## Environment Variables

Create `.env` file:

```env
# API
VITE_API_URL=http://localhost:3001

# WebSocket
VITE_WS_URL=ws://localhost:3002

# Starknet
VITE_STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io
```

---

## Deployment Checklist

- [ ] Set production API URL
- [ ] Set production WebSocket URL
- [ ] Configure JWT_SECRET on server
- [ ] Enable HTTPS
- [ ] Set up error tracking (Sentry)
- [ ] Configure analytics
- [ ] Test all keyboard shortcuts
- [ ] Verify authentication flow
- [ ] Test responsive design
- [ ] Run performance audit

---

## Contributing

1. Follow the existing code style
2. Add TypeScript types
3. Write tests for new features
4. Update this documentation
5. Test on multiple browsers

---

## License

MIT License - HyperX Terminal Team
