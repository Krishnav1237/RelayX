# Wallet Integration - Quick Start Guide

## 🚀 What's Been Implemented

A fully functional Web3 wallet connection system has been added to RelayX with:

- ✅ **Connect Wallet** button in navbar (visible on all pages)
- ✅ Support for **MetaMask**, **Phantom**, and **WalletConnect**
- ✅ Persistent connection (survives page refresh)
- ✅ Clean UI with dropdown menu (copy address, disconnect)
- ✅ Network detection (Ethereum/Solana)
- ✅ Global state management with Zustand
- ✅ Integration-ready for execution flows

## 📍 Where to Find It

The wallet button is located in the **top-right corner of the navbar**, next to the theme toggle button. It appears on:
- Landing page (`/`)
- Dashboard (`/dashboard`)
- Logs page (`/logs`)

## 🎯 User Flow

### Connecting a Wallet

1. Click the **"Connect Wallet"** button in the navbar
2. A modal opens with three wallet options:
   - 🦊 **MetaMask** (Ethereum)
   - 👻 **Phantom** (Solana)
   - 🔗 **WalletConnect** (Universal)
3. Click your preferred wallet
4. Approve the connection in your wallet extension
5. Your address appears in the navbar (e.g., `0x12...ab34`)

### Using Connected Wallet

Once connected:
- Click the address to open a dropdown menu
- **Copy Address**: Copies full address to clipboard
- **Disconnect**: Disconnects wallet and clears state

### Auto-Reconnect

- Wallet automatically reconnects on page refresh
- Works if wallet extension is unlocked
- Silent failure if wallet is unavailable (user can manually reconnect)

## 💻 For Developers

### Accessing Wallet State

```typescript
import { useWalletStore } from '@/lib/wallet';

function MyComponent() {
  const { isConnected, address, networkType } = useWalletStore();
  
  if (isConnected) {
    console.log('Wallet:', address);
    console.log('Network:', networkType); // 'ethereum' or 'solana'
  }
}
```

### Using in API Calls

```typescript
import { getWalletInfo } from '@/lib/wallet/integration';

async function executeIntent(intent: string) {
  const wallet = getWalletInfo();
  
  if (!wallet.isConnected) {
    throw new Error('Please connect wallet first');
  }
  
  const response = await fetch('/api/execute', {
    method: 'POST',
    body: JSON.stringify({
      intent,
      walletAddress: wallet.address,
      network: wallet.networkType,
    }),
  });
  
  return response.json();
}
```

### Dashboard Integration

The dashboard already shows connected wallet info in the right sidebar when a wallet is connected.

## 🧪 Testing

### Test MetaMask Connection

1. Install [MetaMask extension](https://metamask.io/download/)
2. Create or import a wallet
3. Go to RelayX app
4. Click "Connect Wallet" → "MetaMask"
5. Approve in MetaMask popup
6. Verify address appears in navbar

### Test Phantom Connection

1. Install [Phantom extension](https://phantom.app/download)
2. Create or import a wallet
3. Go to RelayX app
4. Click "Connect Wallet" → "Phantom"
5. Approve in Phantom popup
6. Verify address appears in navbar

### Test Persistence

1. Connect any wallet
2. Refresh the page (F5)
3. Verify wallet auto-reconnects
4. Address should still be visible

### Test Disconnect

1. Connect a wallet
2. Click the address in navbar
3. Click "Disconnect"
4. Verify button returns to "Connect Wallet"

## 🎨 UI/UX Features

- **Smooth animations** using Framer Motion
- **Theme-matched** styling (emerald/cyan accents)
- **Loading states** during connection
- **Error handling** with user-friendly messages
- **Responsive design** works on mobile and desktop
- **Keyboard accessible** (can tab through UI)

## 📁 File Structure

```
frontend/
├── components/
│   ├── wallet-button.tsx          # Main button in navbar
│   ├── wallet-connect-modal.tsx   # Connection modal
│   ├── wallet-provider.tsx        # Auto-reconnect wrapper
│   └── navbar.tsx                 # Updated with wallet button
├── lib/wallet/
│   ├── store.ts                   # Zustand state management
│   ├── types.ts                   # TypeScript types
│   ├── utils.ts                   # Helper functions
│   ├── integration.ts             # Integration utilities
│   ├── examples.ts                # Usage examples
│   ├── connectors/
│   │   ├── metamask.ts           # MetaMask integration
│   │   ├── phantom.ts            # Phantom integration
│   │   └── walletconnect.ts      # WalletConnect integration
│   └── hooks/
│       └── useAutoConnect.ts     # Auto-reconnect hook
└── app/
    ├── layout.tsx                 # Includes WalletProvider
    └── dashboard/page.tsx         # Shows wallet info
```

## 🔧 Configuration

No configuration needed! The wallet system works out of the box.

### Optional: Customize Wallet Options

To add/remove wallet options, edit `frontend/components/wallet-connect-modal.tsx`:

```typescript
const walletOptions: WalletOption[] = [
  {
    type: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect with MetaMask wallet",
  },
  // Add more wallets here...
];
```

## 🐛 Troubleshooting

### "MetaMask is not installed"
- Install the MetaMask browser extension
- Refresh the page after installation

### "Phantom wallet is not installed"
- Install the Phantom browser extension
- Refresh the page after installation

### Wallet doesn't auto-reconnect
- Wallet extension may be locked
- Unlock your wallet and try manual connection
- Check browser console for errors

### Connection fails
- Check that wallet extension is installed and unlocked
- Try refreshing the page
- Check browser console for detailed error messages

## 📚 Additional Resources

- **Full Documentation**: See `WALLET.md` for complete details
- **Usage Examples**: See `lib/wallet/examples.ts` for code examples
- **Type Definitions**: See `lib/wallet/types.ts` for TypeScript types

## 🎉 Next Steps

The wallet integration is **ready to use**! You can now:

1. ✅ Connect wallets on any page
2. ✅ Access wallet state in components
3. ✅ Include wallet info in API calls
4. ✅ Build wallet-dependent features

### Future Enhancements (Not Yet Implemented)

- Transaction signing
- Balance display
- Network switching UI
- ENS/SNS name resolution
- Multi-wallet support
- Transaction history

## 🤝 Support

If you encounter issues:
1. Check browser console for errors
2. Verify wallet extension is installed and unlocked
3. Try disconnecting and reconnecting
4. Check the full documentation in `WALLET.md`

---

**Status**: ✅ Fully Functional  
**Version**: 1.0.0  
**Last Updated**: May 1, 2026
