# Ever Life Vault

A comprehensive personal dashboard and feeds aggregator application built with modern web technologies.

## Project Overview

Ever Life Vault is a personal productivity application that provides:
- **Dashboard Widgets**: Grid-based dashboard with drag-and-drop reordering and per-user persistence
- **Feeds Aggregator**: Centralized view of Reddit posts, RSS feeds, and unread Gmail/Outlook messages
- **Secure Vault**: Client-side encrypted storage for credentials and tokens
- **External Integrations**: OAuth flows for various services through a local proxy server

## Technologies Used

This project is built with:

- **Frontend**: React 19, TypeScript, Vite
- **UI Components**: shadcn-ui, Radix UI, Tailwind CSS
- **Backend**: Fastify server with TypeScript
- **Database**: Supabase
- **State Management**: TanStack Query (React Query)
- **Authentication**: OAuth flows for Reddit, Google, Microsoft
- **Development**: ESLint, Vitest, TypeScript

## Getting Started

### Prerequisites

- Node.js (recommended: use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- pnpm (recommended package manager)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd ever-life-vault

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

### Development Commands

- **Install deps and run web app**: `pnpm i && pnpm dev`
- **Run proxy server for external integrations**: `pnpm proxy`
- **Generate Supabase types**: `pnpm types:generate`
- **Run tests**: `pnpm test`
- **Build for production**: `pnpm build`

## Project Architecture

### Dashboard Widgets

- Grid-based dashboard with drag-and-drop reordering
- Per-user persistence to `public.dashboard_layouts` table
- Modular widget system via `src/features/dashboard-widgets/`
- See `docs/dashboard-widgets.md` for detailed architecture and tracking

### Feeds Aggregator

- **Reddit Integration**: OAuth flow for accessing top posts
- **RSS Feeds**: Aggregate content from various RSS sources
- **Email Integration**: Unread message aggregation from Gmail and Outlook
- **Social Media**: Scaffolded for future Twitter/Facebook/Instagram integrations

### Security & Data

- All OAuth credentials and tokens stored in encrypted vault
- Client-side encryption ensures no sensitive data on server
- Local proxy server handles external API integrations
- Configure `server/.env` as documented in `server/README.md`

### Server Architecture

- **Proxy Server**: Fastify-based TypeScript server for external integrations
- **Routes**: Modular route structure in `server/index.ts`
- **Plugins**: Organized plugin system for different functionalities
- **Environment**: Configured via `server/.env` file

## Development Workflow

### Working with External Services

1. Configure OAuth credentials in `server/.env`
2. Start the proxy server with `pnpm proxy`
3. OAuth flows will redirect through the local proxy
4. Tokens are encrypted and stored client-side

### Adding New Widgets

1. Create widget component in `src/features/dashboard-widgets/`
2. Implement drag-and-drop functionality
3. Add persistence logic to dashboard layout system
4. Update types and documentation

### Testing

- Unit tests with Vitest
- Component testing with React Testing Library
- Run tests with `pnpm test` or `pnpm test:watch`

## Deployment

### Building for Production

```sh
# Build the application
pnpm build

# Preview the build
pnpm preview
```

### Environment Configuration

- Copy `server/.env.example` to `server/.env`
- Configure OAuth credentials for external services
- Set up Supabase project and update environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is private and proprietary.

## Support

For questions or issues, please refer to the project documentation or create an issue in the repository.
