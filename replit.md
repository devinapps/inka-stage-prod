# Voice AI Agent Application

## Overview
This project is a full-stack voice AI agent application called "Inka", offering a voice-activated AI assistant with speech recognition and text-to-speech capabilities. Built with React and Express.js, it features a modern UI using shadcn/ui and Tailwind CSS. The application aims to provide an engaging user experience through advanced voice AI integration, including database-managed call limit system. The business vision is to deliver a seamless, intuitive, and scalable voice AI solution with configurable operational limits.

## Recent Changes (August 14, 2025)
- **WebRTC Integration**: Implemented advanced WebRTC-based noise filtering system with 7-stage audio processing
- **Enhanced Noise Filtering**: Added aggressive mode and 4 noise sensitivity levels (low/medium/high/aggressive)
- **Audio Processing Chain**: Notch filter, high-pass, speech enhancer, low-pass, compressor, noise gate, limiter
- **User Controls**: WebRTC toggle button and enhanced noise level controls in UI
- **ElevenLabs Optimization**: WebRTC filters specifically tuned for voice AI conversations
- **Fallback System**: Legacy audio filters as backup when WebRTC is disabled
- **Real-time Monitoring**: Audio metrics tracking for compression gain, noise floor, gate status

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
- **Call Limits System**: Database-managed daily limits (default: 5min per user, 180min total), stored in `system_settings` table, configurable via admin APIs and UI, tracked in `call_logs` table, real-time enforcement every 10 seconds during calls, auto-termination when limits exceeded, cleanup mechanisms for orphaned calls.
- **Real-time Call Monitoring**: Periodic limit checking during active calls (every 10s), automatic call termination when limits exceeded, precise duration tracking with endReason logging.
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