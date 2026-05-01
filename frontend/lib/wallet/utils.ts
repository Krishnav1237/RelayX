export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  // Fallback for older browsers
  return new Promise((resolve, reject) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      textArea.remove();
      resolve();
    } catch (error) {
      textArea.remove();
      reject(error);
    }
  });
}

export function getNetworkName(networkType: string | null): string {
  switch (networkType) {
    case 'ethereum':
      return 'Ethereum';
    case 'solana':
      return 'Solana';
    default:
      return 'Unknown';
  }
}

export function getWalletIcon(walletType: string | null): string {
  switch (walletType) {
    case 'metamask':
      return '🦊';
    case 'phantom':
      return '👻';
    case 'walletconnect':
      return '🔗';
    default:
      return '💼';
  }
}
