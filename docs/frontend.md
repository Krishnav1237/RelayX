# Frontend Implementation

RelayX frontend is a Next.js React dashboard for requesting yield analysis and monitoring executions.

## Overview

**Tech Stack**:
- Next.js 14+ (server + client components)
- React 18+ (hooks)
- TailwindCSS (styling)
- TypeScript (type safety)

**Location**: `frontend/`

## Architecture

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout + providers
│   ├── globals.css             # TailwindCSS + globals
│   ├── page.tsx                # Home: request submission
│   ├── dashboard/
│   │   ├── page.tsx            # Dashboard: trace + results
│   │   └── logs/page.tsx       # Logs: historical sessions
│   └── api/ (no API routes)
├── components/
│   ├── navbar.tsx              # Header with logo
│   ├── floating-panel.tsx       # Execution status panel
│   ├── theme-toggle.tsx        # Dark mode switcher
│   ├── wallet-button.tsx       # Wallet connect UI
│   ├── background.tsx          # Animated background
│   └── ...
├── lib/
│   ├── execution.ts            # Response normalization + session
│   ├── utils.ts                # Utility functions
│   └── wallet/
│       └── ...
├── public/
│   └── ...
├── next.config.ts              # Next.js config + API rewrite
└── ...
```

## Key Pages

### Home (`app/page.tsx`)

**Purpose**: Submit yield request.

**Workflow**:

1. User enters intent (e.g., "find best yield on ETH")
2. Click "Analyze" → calls `POST /api/analyze`
3. Frontend receives `pending_approval` status + approval ID
4. Auto-navigates to `/dashboard` with session stored

**Features**:

- Intent input validation
- Error toast on request failure
- Loading spinner
- Auto-redirect on success

### Dashboard (`app/dashboard/page.tsx`)

**Purpose**: Monitor execution, approve/execute, view trace.

**Workflow**:

1. Display trace entries in real-time (or loaded from session)
2. Show summary: selected protocol, APY, confidence, explanation
3. User reviews and clicks "Approve & Execute"
4. Frontend receives `SwapCalldata` and prompts MetaMask via `submitSwapTransaction`
5. If transaction succeeds, frontend calls `POST /api/execute/confirm` with approval ID
6. Display final result: status, swap details, memory update

**Features**:

- Live trace streaming (if SSE added)
- Agent metadata in trace entries
- Collapsible sections: summary, trace, debug
- ENS/AXL/memory influence display
- Approve button (disabled if approval expired)
- Error recovery: can re-request on failure

### Logs (`app/dashboard/logs/page.tsx`)

**Purpose**: View historical sessions.

**Workflow**:

1. Load past executions from localStorage
2. Display session list with summary
3. Click to view full trace + results
4. Option to re-execute from logs

**Features**:

- Local session persistence
- Search/filter by protocol or intent
- Export trace as JSON
- Clear old sessions

## API Integration

**Location**: `lib/execution.ts`

Handles:

1. **Request normalization**: Format user input for backend
2. **Response normalization**: Transform backend response for UI
3. **Wallet Interaction**: Uses `@/lib/wallet-actions.ts` to trigger `eth_sendTransaction` via MetaMask using the injected EIP-1193 provider.
4. **Session persistence**: Store/retrieve from localStorage
5. **Terminal events**: Detect when trace is "complete"

### useExecution Hook (if using)

```typescript
const {
  loading,
  error,
  result,
  approval,
  trace,
  summary,
  executeConfirm
} = useExecution(intent);
```

### API Proxy

**File**: `next.config.ts`

```typescript
rewrites: async () => [
  {
    source: '/api/:path*',
    destination: 'http://localhost:3001/:path*'
  }
]
```

Frontend calls `fetch('/api/analyze')` → proxied to `http://localhost:3001/analyze`.

## Component Examples

### Request Submission

```typescript
// app/page.tsx
const [intent, setIntent] = useState('');
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent })
  });
  const result = await res.json();
  
  // Store approval & navigate
  sessionStorage.setItem('approval', result.approval.id);
  router.push('/dashboard');
};
```

### Trace Display

```typescript
// components/trace-display.tsx
const TraceDisplay = ({ trace }: { trace: AgentTrace[] }) => {
  return (
    <div className="space-y-2">
      {trace.map((entry, i) => (
        <div key={i} className="p-2 border rounded">
          <div className="font-bold">{entry.agent} → {entry.step}</div>
          <div className="text-sm">{entry.message}</div>
          {entry.metadata && (
            <pre className="text-xs bg-gray-100 p-1 mt-1 overflow-auto">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {new Date(entry.timestamp).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Summary Display

```typescript
// components/summary-display.tsx
const SummaryDisplay = ({ summary }: { summary: ExecutionSummary }) => {
  return (
    <div className="border-l-4 border-blue-500 p-4">
      <h2 className="font-bold">{summary.finalProtocol}</h2>
      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
        <div>APY: {summary.selectedProtocol}</div>
        <div>Confidence: {(summary.confidence * 100).toFixed(0)}%</div>
        <div>Retried: {summary.wasRetried ? 'Yes' : 'No'}</div>
        <div>Steps: {summary.totalSteps}</div>
      </div>
      <p className="mt-3 text-sm italic">{summary.explanation}</p>
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">Decision Impact</summary>
        <pre className="text-xs bg-gray-100 p-2 mt-2 overflow-auto">
          {JSON.stringify(summary.decisionImpact, null, 2)}
        </pre>
      </details>
    </div>
  );
};
```

## Session Management

**LocalStorage Keys**:

- `relayX_approval`: Current approval ID
- `relayX_session`: Current execution result
- `relayX_history`: Array of past executions

**Persistence**:

```typescript
// Save after request
sessionStorage.setItem('relayX_approval', approval.id);
localStorage.setItem('relayX_history', JSON.stringify([...history, newResult]));

// Restore on mount
const saved = localStorage.getItem('relayX_history');
setHistory(saved ? JSON.parse(saved) : []);
```

## Styling

**Framework**: TailwindCSS

Key classes:

- `container` – max-width container
- `space-y-*` – vertical spacing
- `grid grid-cols-*` – responsive grids
- `shadow-*` – shadows
- `rounded-*` – border radius
- `dark:` – dark mode variants

**Dark Mode**: Implemented via `theme-toggle.tsx`.

## Error Handling

**UI States**:

1. **Idle**: No request
2. **Loading**: Request in progress (spinner)
3. **Success**: Result ready (show trace + summary)
4. **Error**: Request failed (show error message + retry button)
5. **Expired**: Approval expired (show re-request button)

**Toasts** (if using react-toastify):

```typescript
import { toast } from 'react-toastify';

toast.error('Request failed: ' + error.message);
toast.success('Execution completed!');
```

## Performance

**Optimization**:

- Next.js Image optimization for static images
- Client-side filtering (localStorage doesn't require network)
- Memoization of trace display (prevent re-renders)
- Lazy load logs page

**Example**:

```typescript
import { memo } from 'react';

const TraceEntry = memo(({ entry }) => (
  <div>{entry.message}</div>
));
```

## Mobile Responsiveness

**Breakpoints** (TailwindCSS):

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

Use responsive classes:

```typescript
<div className="w-full md:w-1/2 lg:w-1/3">...</div>
```

## Accessibility

- Use semantic HTML (`<button>`, `<input>`, `<label>`)
- ARIA labels: `<button aria-label="..." />`
- Keyboard navigation: All interactive elements focusable
- Color contrast: TailwindCSS defaults are WCAG AA compliant

## Testing (Optional)

**Framework**: Jest + React Testing Library

Example:

```typescript
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('renders intent input', () => {
  render(<Home />);
  expect(screen.getByPlaceholderText(/intent/i)).toBeInTheDocument();
});
```

## Env Variables

**Frontend** (`.env.local`):

```bash
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

Prefix `NEXT_PUBLIC_` to expose to browser.

**Backend API Rewrite** (in `next.config.ts`):

```typescript
rewrites: async () => [
  {
    source: '/api/:path*',
    destination: `${process.env.NEXT_PUBLIC_API_BASE}/:path*`
  }
]
```

