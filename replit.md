# Voice AI Agent Application

## Overview
This project is a full-stack voice AI agent application called "Inka", offering a voice-activated AI assistant with speech recognition and text-to-speech capabilities. Built with React and Express.js, it features a modern UI using shadcn/ui and Tailwind CSS. The application aims to provide an engaging user experience through advanced voice AI integration, including database-managed call limit system. The business vision is to deliver a seamless, intuitive, and scalable voice AI solution with configurable operational limits.

## Recent Changes (August 22, 2025)
- **Critical Browser Disconnect Fix**: Fixed beforeunload events not ending calls due to React state timing issues
- **Enhanced Event Detection**: Added popstate and enhanced visibilitychange handlers for comprehensive navigation coverage
- **Refs-based Event Handling**: Used useRef for callLogId/userId in event handlers to ensure data availability during page unload
- **Language Localization**: Implemented multi-language support for daily usage text and mute buttons via query string
- **Multiple Detection Layers**: Now has 4 layers: beforeunload, visibilitychange, popstate, and 30-minute cleanup service
- **Event Reason Tracking**: Added navigation, page_hidden, page_refresh endReasons for better analytics
- **Orphaned Call Prevention**: Fixed cleanup system threshold from 2→30 minutes preventing false disconnections

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: React Query for server state
- **Routing**: Wouter
- **Voice Integration**: ElevenLabs React SDK

### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (via Neon Database)
- **Session Management**: PostgreSQL-based sessions with `connect-pg-simple`
- **Voice API**: ElevenLabs integration for signed URL generation and voice processing
- **Authentication**: JWT token-based authentication for secure access and dynamic call limits.

### Build System
- **Module System**: ES Modules
- **TypeScript**: Strict configuration with path aliases
- **Development**: Concurrent frontend (Vite) and backend (tsx) servers with hot reload.
- **Production**: Bundled backend with esbuild, static frontend assets.

### Deployment Infrastructure
- **Containerization**: Docker with multi-stage builds for production optimization
- **Orchestration**: Docker Compose for both development and production environments
- **Reverse Proxy**: Nginx with SSL termination and static file serving
- **SSL**: Let's Encrypt automatic certificate management
- **Database**: Containerized PostgreSQL with persistent volumes and automated backups
- **Caching**: Redis for session storage and performance optimization

### Key Components & Features
- **Voice AI Components**: `VoiceAgent` (ElevenLabs SDK), `DemoVoiceAgent` (Web Speech API fallback), `VoiceAvatar`, custom speech synthesis hook.
- **Noise Filtering System**: Advanced audio processing with `AudioFilters` class, native browser noise suppression, custom noise gate, high-pass filtering, dynamic range compression, real-time monitoring with adjustable sensitivity levels (low/medium/high for different environments).
- **UI Components**: Comprehensive shadcn/ui library, custom theming, mobile-responsive design, toast notifications, noise filter controls with user-friendly interface.
- **Database Schema**: Users table, call logs with precise duration tracking (seconds-based), system_settings table for configurable limits, Drizzle ORM for type-safe operations, Zod for validation.
- **Data Flow**: User voice input -> Noise filtering -> Backend generates ElevenLabs signed URL -> WebSocket connection established -> ElevenLabs processes clean audio -> AI response streamed -> UI updates.
- **Authentication**: Token verification on app startup, dynamic user-specific call limits based on token data.
- **Call Limits System**: Database-managed daily limits (default: 10min per user, 180min total system-wide), stored in `system_settings` table, configurable via admin APIs and UI, tracked in `call_logs` table, real-time enforcement every 1-3 seconds during calls, force termination when limits exceeded, cleanup mechanisms for orphaned calls.
- **Force End Call System**: Automatic call termination when either user daily limit or system daily limit is reached. Backend calculates exact allowed duration from actual call start time to prevent over-recording, updates call logs with proper endReason ('user_limit_exceeded' or 'system_limit_exceeded') and accurate duration_seconds, frontend immediately disconnects ElevenLabs session and clears all call state when limit exceeded. Fixed duration calculation bug that was causing 0-second recordings on force-end (August 15, 2025).
- **Real-time Call Monitoring**: Enhanced limit checking during active calls (every 1s), automatic call termination with proper cleanup, precise duration tracking with multiple endReason types, 30-second warning system before limits are reached, visual warning notifications in UI.
- **Warning System**: 30-second advance warnings for approaching limits, differentiated user vs system limit warnings, real-time UI notifications with color-coded alerts (orange for user limits, yellow for system limits).
- **Microphone Controls**: Enhanced mute/unmute functionality during active calls with visual feedback, proper state management, and toggle behavior. Features red/green visual states, muted/unmuted icons, and Vietnamese language support ("Tắt tiếng"/"Mở tiếng"). State resets automatically on call disconnect.
- **Browser Disconnect Handling**: Advanced `beforeunload` event handling with `navigator.sendBeacon` for reliable call termination on browser close/refresh, cleanup service running every 10 seconds with 30-second orphan detection, automatic orphaned call cleanup on token verification.
- **Internationalization**: Multi-language support (Vietnamese, English) via URL parameters.
- **Admin Panel**: Basic admin interface for data management, usage statistics, and system settings management including configurable call limits.

## External Dependencies

- **ElevenLabs**: Core voice AI conversation API.
- **Radix UI**: Accessible component primitives for UI.
- **React Query (@tanstack/react-query)**: Server state management.
- **Drizzle ORM**: Database toolkit for PostgreSQL.
- **Neon Database (@neondatabase/serverless)**: PostgreSQL database provider.
- **Zod**: Runtime type validation.
- **Vite**: Frontend build tool.
- **tsx**: TypeScript execution for backend development.
- **esbuild**: Production backend bundling.
- **Tailwind CSS**: Utility-first styling framework.
- **Web Speech API**: Browser-native speech recognition/synthesis (for demo/fallback).
- **Media Devices API**: For microphone access.