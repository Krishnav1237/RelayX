# Wallet Integration

This document describes the wallet connection feature implemented in RelayX.

## Overview

The wallet integration provides a complete Web3 wallet connection system supporting:
- **MetaMask** (Ethereum/EVM)
- **Phantom** (Solana)
- **WalletConnect** (Broad wallet support via EIP-6963)

## Features

### ✅ Implemented

1. **Connect Wallet Button**
   - Located in the navbar (top-right)
   - Visible on all pages (landing, dashboard, logs)
   - Smooth animations and theme-matched styling

2. **Wallet Selection Modal**
   - Clean modal with wallet options
   - Loading states during connection
   - Error handling with user-friendly messages
   - Backdrop blur effect

3. **Post-Connection UI**
   - Shortened wallet address display (e.g., `0x12...ab34`)
   - Dropdown menu with:
     - Copy address functionality
     - Disconnect option
   - Network indicator (Ethereum/Solana)
   - Wallet type icon

4. **State Management**
   - Global state using Zustand
   - Persistent connection (localStorage)
   - Auto-reconnect on page refresh
   - Hydration-safe implementation

5. **Network Handling**
   - Automatic network detection
   - Network type display
   - Account change listeners
   - Chain change listeners

6. **Integration Ready**
   - Wallet address exposed to dashboard
   - Utility functions for execution flow
   - Type-safe wallet state access

## Architecture

### File Structure

```
frontend/
├── components/
│   ├── wallet-button.tsx          # Main wallet button component
│   ├── wallet-connect-modal.tsx   # Connection modal
│   ├── wallet-provider.tsx        # Auto-reconnect provider
│   └── navbar.tsx                 # Updated with wallet button
├── lib/
│   └── wallet/
│       ├── store.ts               # Zustand state management
│       ├── types.ts               # TypeScript types
│       ├── utils.ts               # Helper functions
│       ├── integration.ts         # Integration utilities
│       ├── connectors/
│       │   ├── metamask.ts        # MetaMask connector
│       │   ├── phantom.ts         # Phantom connector
│       │   └── walletconnect.ts   # WalletConnect connector
│       └── hooks/
│           └── useAutoConnect.ts  # Auto-reconnect hook
└── app/
    └── layout.tsx                 # Updated with WalletProvider
```

### State Management

The wallet state is managed using Zustand with persistence:

```typescript
interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletType: 'metamask' | 'phantom' | 'walletconnect' | null;
  networkType: 'ethereum' | 'solana' | null;
  isConnecting: boolean;
  error: string | null;
}
```

### Connectors

Each wallet type has its own connector module:

- **MetaMask**: Uses `window.ethereum` with ethers.js
- **Phantom**: Uses `window.solana` or `window.phantom.solana`
- **WalletConnect**: Uses EIP-6963 for broad wallet support

## Usage

### Basic Usage

The wallet button is automatically included in the navbar. No additional setup required.

### Accessing Wallet Data

```typescript
import { useWalletStore } from '@/lib/wallet';

function MyComponent() {
  const { isConnected, address, networkType } = useWalletStore();
  
  if (isConnected) {
    console.log('Connected to:', address);
    console.log('Network:', networkType);
  }
}
```

### Integration with Execution Flow

```typescript
import { getWalletInfo, requireWalletAddress } from '@/lib/wallet/integration';

// Check if wallet is connected
const walletInfo = getWalletInfo();
if (walletInfo.isConnected) {
  // Include wallet address in API call
  await fetch('/api/execute', {
    method: 'POST',
    body: JSON.stringify({
      intent: "Swap 100 USDC",
      walletAddress: walletInfo.address,
      network: walletInfo.networkType
    })
  });
}

// Or require wallet address (throws if not connected)
try {
  const address = requireWalletAddress();
  // Use address...
} catch (error) {
  // Handle not connected
}
```

### Subscribe to Wallet Changes

```typescript
import { subscribeToWallet } from '@/lib/wallet/integration';

const unsubscribe = subscribeToWallet((state) => {
  console.log('Wallet state changed:', state);
});

// Later: cleanup
unsubscribe();
```

## User Flow

1. **Connect**
   - User clicks "Connect Wallet" button
   - Modal opens with wallet options
   - User selects wallet (MetaMask/Phantom/WalletConnect)
   - Wallet extension prompts for approval
   - On approval: address is stored and displayed

2. **Connected State**
   - Button shows shortened address
   - Clicking opens dropdown menu
   - User can copy address or disconnect

3. **Disconnect**
   - User clicks "Disconnect" in dropdown
   - State is cleared
   - Button returns to "Connect Wallet"

4. **Auto-Reconnect**
   - On page refresh, wallet automatically reconnects
   - Uses stored wallet type from localStorage
   - Silent failure if wallet is locked/unavailable

## Error Handling

The system handles various error scenarios:

- Wallet not installed → Clear error message with install link
- User rejection → "Connection request rejected by user"
- Network errors → Graceful fallback
- Account changes → Auto-reload page
- Chain changes → Auto-reload page

## Styling

The wallet UI matches the existing RelayX theme:
- **Colors**: Emerald and cyan accents
- **Style**: Obsidian dark theme
- **Animations**: Smooth framer-motion transitions
- **Typography**: Consistent with existing design

## Future Enhancements

Potential improvements for future iterations:

1. **Network Switching**
   - Add UI to switch between networks
   - Support multiple chains (Polygon, Arbitrum, etc.)

2. **Multi-Wallet Support**
   - Allow connecting multiple wallets simultaneously
   - Wallet switching without disconnecting

3. **Transaction Signing**
   - Sign messages for authentication
   - Sign transactions for execution

4. **Balance Display**
   - Show token balances
   - Display native currency balance

5. **ENS/SNS Support**
   - Resolve ENS names (Ethereum)
   - Resolve SNS names (Solana)

6. **Transaction History**
   - Show recent transactions
   - Link to block explorer

## Dependencies

```json
{
  "ethers": "^6.x",
  "zustand": "^4.x"
}
```

## Browser Support

- Chrome/Brave (with MetaMask/Phantom extension)
- Firefox (with MetaMask/Phantom extension)
- Edge (with MetaMask/Phantom extension)
- Safari (limited - depends on wallet support)

## Security Considerations

1. **No Private Keys**: Never stores or transmits private keys
2. **User Approval**: All connections require explicit user approval
3. **Session Storage**: Only stores public addresses
4. **HTTPS Only**: Wallet connections require secure context
5. **Input Validation**: All user inputs are validated

## Testing

To test the wallet integration:

1. **MetaMask**:
   - Install MetaMask extension
   - Click "Connect Wallet" → "MetaMask"
   - Approve connection in MetaMask popup

2. **Phantom**:
   - Install Phantom extension
   - Click "Connect Wallet" → "Phantom"
   - Approve connection in Phantom popup

3. **WalletConnect**:
   - Have any Web3 wallet installed
   - Click "Connect Wallet" → "WalletConnect"
   - Approve connection

4. **Persistence**:
   - Connect wallet
   - Refresh page
   - Verify wallet auto-reconnects

5. **Disconnect**:
   - Click connected address
   - Click "Disconnect"
   - Verify state clears

## Troubleshooting

### Wallet not detected
- Ensure wallet extension is installed
- Refresh the page
- Check browser console for errors

### Auto-reconnect fails
- Wallet may be locked
- Try manual reconnection
- Check localStorage for `wallet_connected` key

### Network mismatch
- Currently displays detected network
- Future: Add network switching UI

## Support

For issues or questions about the wallet integration, check:
- Browser console for error messages
- Wallet extension logs
- Network tab for API calls
