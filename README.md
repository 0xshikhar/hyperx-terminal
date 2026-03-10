# HyperX Terminal

<p align="center">
  <img src="./apps/web/public/logo.svg" alt="HyperX Terminal Logo" width="120" />
</p>

<p align="center">
  <strong>Professional Perpetual Futures Trading on Starknet</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#screenshots">Screenshots</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Starknet-L2-purple?logo=ethereum" alt="Starknet" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## 🚀 Features

### Modern Terminal UI
- **Cyberpunk Design**: Dark theme with cyan accents, monospace fonts, and neon glow effects
- **Professional Layout**: Resizable panels, real-time data streams, and intuitive controls
- **Animations**: Smooth transitions powered by Framer Motion
- **Responsive**: Works seamlessly on desktop, tablet, and mobile

### Starknet Integration
- **Wallet Support**: Argent X, Braavos, Cartridge, and more via `@starknet-io/get-starknet`
- **Secure Authentication**: JWT-based auth with Starknet message signing (SNIP-12)
- **On-Chain Settlement**: Direct integration with Starknet DEXs

### Advanced Trading Features
- **Real-Time Orderbook**: Live market depth with WebSocket updates
- **Candlestick Charts**: Professional charts via `lightweight-charts`
- **Position Management**: Track PnL, margin, and leverage
- **DEX Aggregator**: Route orders across multiple DEXs (Extended, Paradex)
- **Price Alerts**: Set alerts for price movements

### Developer Experience
- **Command Palette**: Quick access to all features (`Ctrl+K`)
- **Keyboard Shortcuts**: Power-user productivity (`?` for help)
- **Theme Toggle**: Light/Dark/System modes
- **Type-Safe**: Full TypeScript coverage
- **Hot Reload**: Instant updates during development

---

## 🎮 Quick Start

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 10.0.0
- PostgreSQL

### Installation

```bash
# Clone repository
git clone <repo-url>
cd new-terminal-hyperx

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
pnpm prisma:migrate

# Start development
pnpm dev
```

The application will be available at:
- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **WebSocket**: ws://localhost:3002

### Authentication

1. Visit http://localhost:3000/login
2. Connect your Starknet wallet
3. Sign the authentication message
4. Start trading! 🎉

---

## ⌨️ Keyboard Shortcuts

Press `?` anywhere to see all shortcuts.

### Navigation
- `Ctrl+K` - Open Command Palette
- `G T` - Go to Terminal
- `G M` - Go to Markets
- `G P` - Go to Portfolio
- `Ctrl+T` - Toggle Theme

### Trading
- `B` - Focus Buy
- `S` - Focus Sell
- `Enter` - Submit Order

---

## 📸 Screenshots

<p align="center">
  <em>Trading Terminal</em>
  <br />
  <img src="./docs/screenshots/terminal.png" alt="Trading Terminal" width="800" />
</p>

<p align="center">
  <em>Orderbook & Trade Form</em>
  <br />
  <img src="./docs/screenshots/trading.png" alt="Trading Interface" width="800" />
</p>

---

## 🏗️ Architecture

```
new-terminal-hyperx/
├── apps/
│   ├── web/              # Frontend (Vite + React + TypeScript)
│   ├── api/              # Backend API (Fastify + Prisma)
│   └── ws/               # WebSocket Server (ws library)
├── packages/
│   └── types/            # Shared TypeScript types
├── docs/                 # Documentation
└── scripts/              # Build & deployment scripts
```

### Tech Stack

**Frontend**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Zustand for state management
- TanStack Query for server state
- Framer Motion for animations
- shadcn/ui components

**Backend**
- Fastify web framework
- Prisma ORM with PostgreSQL
- JWT authentication
- Redis for caching (optional)

**WebSocket**
- Native ws library
- Redis pub/sub for scaling
- JWT authentication

**Blockchain**
- Starknet.js v6
- @starknet-io/get-starknet
- SNIP-12 typed data signing

---

## 📚 Documentation

- **[Quick Start Guide](./QUICKSTART.md)** - Get up and running in minutes
- **[Frontend Documentation](./apps/web/docs/FRONTEND.md)** - Complete frontend guide
- **[API Documentation](./docs/API.md)** - Backend API reference
- **[Architecture](./docs/ARCHITECTURE.md)** - System design

---

## 🔧 Development

### Common Commands

```bash
# Start all services
pnpm dev

# Start specific service
pnpm dev:web
pnpm dev:api
pnpm dev:ws

# Build for production
pnpm build

# Database operations
pnpm prisma:migrate
pnpm prisma:studio

# Type checking
pnpm typecheck
```

### Adding Features

See [Contributing Guide](./CONTRIBUTING.md) for details.

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test:web
pnpm test:api

# Run with coverage
pnpm test:coverage
```

---

## 🚀 Deployment

### Docker

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d
```

### Environment Variables

See `.env.example` for required variables.

Key variables:
- `JWT_SECRET` - Required for authentication
- `DATABASE_URL` - PostgreSQL connection string
- `VITE_API_URL` - API endpoint URL

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md).

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- **Starknet Foundation** - For building the future of Ethereum scaling
- **Starknet.js Team** - For the excellent SDK
- **shadcn/ui** - For the beautiful component library
- **All Contributors** - Thank you for making this possible!

---

## 📞 Support

- **Discord**: [Join our community](https://discord.gg/hyperx)
- **Twitter**: [@hyperx_terminal](https://twitter.com/hyperx_terminal)
- **Email**: support@hyperx.io
- **Issues**: [GitHub Issues](https://github.com/hyperx/terminal/issues)

---

<p align="center">
  <strong>Built with ❤️ by the HyperX Team</strong>
</p>

<p align="center">
  <a href="https://hyperx.io">Website</a> •
  <a href="https://docs.hyperx.io">Docs</a> •
  <a href="https://twitter.com/hyperx_terminal">Twitter</a>
</p>
