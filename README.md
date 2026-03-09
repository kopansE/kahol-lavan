# Kahol-Lavan (כחול-לבן) 🅿️

A peer-to-peer parking space sharing platform that connects drivers leaving their parking spots with those looking for parking. Built with React, React Native, and Supabase.

## 📖 Overview

Kahol-Lavan (Hebrew for "Blue-White," referencing Israeli parking zones) is a comprehensive parking-sharing solution that helps drivers find available parking spots in real-time. The platform enables users to:

- **Publish** when they're leaving a parking spot
- **Reserve** available spots from other users
- **Schedule** future parking availability
- **Communicate** through integrated real-time chat
- **Pay securely** using an integrated wallet system

## 🏗️ Architecture

The project consists of three main components:

### 1. **Web Application** (`/frontend`)

- **Framework**: React 18 with Vite
- **UI Features**:
  - Interactive map with parking spot visualization (Leaflet/React-Leaflet)
  - Real-time parking status updates
  - Integrated chat system (Stream Chat)
  - Wallet and payment management
  - User profile and car information management
  - Search functionality with address autocomplete
  - Parking zone visualization

### 2. **Mobile Application** (`/mobile`)

- **Framework**: React Native with Expo
- **Platform Support**: iOS and Android
- **Features**:
  - Native mobile experience
  - Location services integration
  - Push notifications
  - Real-time map with parking pins
  - Mobile-optimized chat interface
  - Integrated payment flow

### 3. **Backend** (`/supabase`)

- **Platform**: Supabase (PostgreSQL + Edge Functions)
- **Edge Functions** (Deno-based):
  - `save-pin`, `activate-pin`, `deactivate-pin` - Parking spot management
  - `reserve-parking` - Handle parking reservations
  - `schedule-leave`, `handle-scheduled-leave`, `cancel-scheduled-leave` - Future parking scheduling
  - `setup-payment-method`, `complete-payment-setup`, `get-wallet-balance` - Payment processing
  - `create-chat-channel`, `get-user-channels`, `get-stream-token` - Chat system
  - `approve-in-chat`, `cancel-in-chat`, `extend-in-chat` - In-chat actions
  - `geocode-address`, `places-autocomplete`, `get-street-geometry` - Location services
  - `handle-timer-expiration`, `schedule-approval-timer` - Time-based automation
  - `get-user-profile`, `update-user-car-data` - User management
  - `get-active-pins`, `get-pending-notifications` - Real-time updates

## 🚀 Key Features

### Parking Management

- **Real-time Parking Pins**: See available parking spots on an interactive map
- **Parking Zones**: Support for Israeli parking zones (Blue-White system)
- **Status Tracking**: Multiple states - waiting, active, reserved, published
- **Address Reverse Geocoding**: Automatic address resolution for parking locations

### Reservation System

- **Instant Reservations**: Reserve available spots immediately
- **Future Reservations**: Book spots that will be available later
- **Cancellation with Refunds**: Cancel reservations with automatic refund processing
- **Timer-based Approvals**: Automated expiration of pending reservation requests

### Communication

- **Real-time Chat**: Integrated Stream Chat for user-to-user communication
- **In-chat Actions**: Approve, cancel, or extend reservations directly in chat
- **Notifications**: Real-time notification system for parking events

### Payment System

- **Digital Wallet**: Integrated Rapyd payment processing
- **Secure Transactions**: Handle payments and refunds automatically
- **Payment Methods**: Support for multiple payment methods
- **Transaction History**: Complete wallet transaction tracking

### User Experience

- **Google OAuth**: Seamless authentication via Google Sign-In
- **Car Information**: User profiles with vehicle details
- **Search**: Address search with autocomplete
- **Responsive Design**: Works on desktop and mobile browsers

## 🛠️ Technology Stack

### Frontend Technologies

- **React** 18.2.0 - Web UI framework
- **React Native** 0.81.5 - Mobile framework
- **Expo** ~54.0.31 - React Native tooling
- **Vite** 5.0.8 - Build tool and dev server
- **Leaflet** 4.2.1 - Interactive maps
- **Stream Chat** - Real-time messaging
- **React Navigation** - Mobile navigation

### Backend Technologies

- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Database
- **Deno** - Edge functions runtime
- **QStash (Upstash)** - Task scheduling and queuing

### External Services

- **Rapyd** - Payment processing
- **Stream** - Chat infrastructure
- **Google Maps API** - Geocoding and location services
- **Firebase** - Additional hosting/services
- **Ngrok** - Development webhooks

## 📁 Project Structure

```
kahol-lavan/
├── frontend/                 # Web application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts (Chat, Toast)
│   │   ├── utils/           # Utility functions
│   │   └── assets/          # Static assets (parking zones data)
│   └── package.json
├── mobile/                   # Mobile application
│   ├── src/
│   │   ├── components/      # React Native components
│   │   ├── screens/         # App screens
│   │   ├── utils/           # Utilities (edge functions, geocoding)
│   │   ├── styles/          # Style definitions
│   │   └── config/          # Configuration (Supabase)
│   ├── app.json             # Expo configuration
│   └── package.json
├── supabase/                 # Backend
│   ├── functions/           # Edge Functions (27 functions)
│   │   ├── _shared/         # Shared utilities
│   │   └── */               # Individual function directories
│   ├── migrations/          # Database migrations
│   ├── rapydDocs/           # Rapyd API documentation
│   └── .env                 # Environment variables
└── .github/                  # GitHub configuration
    └── pull_request_template.md
```

## 🔧 Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Google Cloud account (for Maps API and OAuth)
- Stream account (for chat)
- Rapyd account (for payments)

#### Web Frontend

```bash
cd frontend
npm install
npm run dev
```

#### Mobile App

```bash
cd mobile
npm install
npm start
```

#### Supabase Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy
```

## 🎯 How It Works

### For Parking Spot Owners:

1. **Mark Your Spot**: Click on the map where you're parked
2. **Activate**: Confirm when you're ready to leave
3. **Get Notified**: Receive requests from users wanting your spot
4. **Chat & Coordinate**: Communicate with the interested party
5. **Complete**: Approve the transfer and receive payment

### For Parking Seekers:

1. **Browse Map**: See available parking spots in real-time
2. **Reserve**: Click on a spot to reserve it
3. **Chat**: Coordinate details with the spot owner
4. **Pay**: Automatic payment from your wallet
5. **Navigate**: Get directions to your reserved spot

### Future Scheduling:

- **Schedule Departure**: Set a future time when you'll leave
- **Pre-book**: Others can reserve your spot in advance
- **Automated Handoff**: System manages the transition automatically

## 💳 Payment Flow

1. Users add funds to their Rapyd wallet
2. When reserving, funds are held in escrow
3. Upon successful handoff, payment is transferred to the spot owner
4. Cancellations result in automatic refunds
5. All transactions are tracked in the wallet history

## 🗺️ Parking Zones

The system supports Israeli parking zones (stored in `parking_zones.json`):

- **Blue-White zones**: Paid parking with time restrictions
- **Zone detection**: Automatic determination based on GPS coordinates
- **Pricing**: Zone-based pricing calculation

## 🧪 Testing

The project includes testing setup:

**Frontend Testing:**

```bash
cd frontend
npm run test
```

Test utilities configured:

- Vitest
- React Testing Library
- MSW (Mock Service Worker) for API mocking

## 📱 Mobile App Configuration

### iOS

- Bundle ID: `com.kahollavan.app`
- Requires location permissions
- Google Maps API key configured in `Info.plist`

### Android

- Package: `com.kahollavan.app`
- Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- Google Maps API key in app config

## 🔐 Security

- **Authentication**: Google OAuth via Supabase Auth
- **Authorization**: Row-Level Security (RLS) policies in PostgreSQL
- **API Keys**: All sensitive keys stored in environment variables
- **Payment Security**: PCI-compliant payment processing via Rapyd
- **Data Privacy**: User data protected with Supabase security features

## 🚧 Database Schema

Key tables:

- `pins` - Parking spot locations and status
- `user_profiles` - Extended user information and car details
- `scheduled_leaves` - Future parking availability
- `future_reservations` - Advanced bookings
- `chat_sessions` - Chat channel associations
- `pending_timers` - Scheduled task management

## 🔄 Real-time Features

The application uses:

- **Supabase Realtime**: Database change subscriptions
- **Stream Chat**: Real-time messaging
- **QStash**: Scheduled job execution
- **WebSockets**: Live updates for parking status

## 🌐 Deployment

### Frontend

Configured for deployment to Vercel (see APP_URL in `.env`)

### Mobile

- Build with EAS Build (Expo Application Services)
- Deploy to App Store and Google Play

### Backend

- Supabase functions auto-deploy
- PostgreSQL hosted on Supabase cloud

## 📄 License

This project is private. All rights reserved.

## 👥 Contributing

This is a private project. For contribution guidelines, please contact the project maintainers.

## 🐛 Known Issues / TODO

- Mobile app requires production API keys for full functionality
- Some functions may need rate limiting implementation
- Consider adding analytics tracking
- Implement more comprehensive error handling

## 📞 Support

For issues, questions, or support, please open an issue in the GitHub repository.

---

**Made with ❤️ for making parking easier in Israel**
