# Frontend (Angular 10) Integration Guide

This guide shows how to build the Angular 10 dashboard that talks to Django and Twilio Conversations. It mirrors the working patterns from the prototype while using Angular best practices: HttpClient, interceptors, guards, RxJS streams, and CDK Virtual Scroll.

Use with: `docs/twilio-setup.md`, `docs/backend-django.md`, `docs/webhooks.md`, and `docs/snippets-index.md`.

---

## 1) Prerequisites
- Angular 10 project (`@angular/cli` v10)
- `@twilio/conversations` installed in the app
- Deployed Django API with endpoints from `docs/backend-django.md`
- Env config with API URL and feature flags

```bash
npm install @twilio/conversations
```

`src/environments/environment.ts`:
```ts
export const environment = {
  production: false,
  apiBaseUrl: 'https://your-api.example.com',
};
```

---

## 2) Auth and HTTP plumbing
Keep the client simple: Django is the source of truth. Use HttpClient and interceptors.

- Auth storage: keep JWT/session indicator as a cookie or `localStorage` token (whatever Django issues)
- Interceptor: attach `Authorization: Bearer <token>` if you’re using JWT
- Guard: prevent navigation without auth

`auth.interceptor.ts` (outline):
```ts
import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('auth_token');
    if (!token) return next.handle(req);
    return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
}
```

`auth.guard.ts` (outline):
```ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}
  canActivate(): boolean {
    const token = localStorage.getItem('auth_token');
    if (!token) { this.router.navigate(['/login']); return false; }
    return true;
  }
}
```

Register the interceptor in `app.module.ts` providers.

---

## 3) Twilio JS SDK client (service)
Initialize the Conversations SDK with a token from Django, handle connection + token refresh.

`twilio-client.service.ts` (outline):
```ts
import { Injectable } from '@angular/core';
import { Client } from '@twilio/conversations';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TwilioClientService {
  private client?: Client;
  private state$ = new BehaviorSubject<'unknown'|'connecting'|'connected'|'disconnected'|'denied'|'error'>('unknown');

  constructor(private http: HttpClient) {}

  private async getToken(): Promise<string> {
    const res = await this.http.post<{ token: string }>(`${environment.apiBaseUrl}/api/twilio/token`, {}).toPromise();
    return res!.token;
  }

  async init(): Promise<Client> {
    const token = await this.getToken();
    this.client = new Client(token);

    this.client.on('connectionStateChanged', (s: any) => this.state$.next(s));
    this.client.on('tokenAboutToExpire', async () => this.client?.updateToken(await this.getToken()));
    this.client.on('tokenExpired', async () => this.client?.updateToken(await this.getToken()));

    return this.client;
  }

  getClient(): Client | undefined { return this.client; }
  connection$() { return this.state$.asObservable(); }
}
```

Notes:
- This matches the prototype’s approach in `src/services/twilio.ts` and `src/services/twilioClient.ts`.
- SDK is for live updates/events. Listing/pagination should use the backend endpoints.

---

## 4) Conversations API service (backend-first)
Call Django to retrieve paginated conversations and details. This mirrors the prototype’s backend aggregation for speed and permissions.

`conversations.service.ts` (outline):
```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface ConversationSummary {
  sid: string; friendlyName?: string; uniqueName?: string;
  lastMessageAt?: string; lastMessagePreview?: string;
}

@Injectable({ providedIn: 'root' })
export class ConversationsService {
  constructor(private http: HttpClient) {}
  list(page = 1, limit = 15) {
    return this.http.get<{ conversations: ConversationSummary[]; pagination: any }>(
      `${environment.apiBaseUrl}/api/conversations?page=${page}&limit=${limit}`
    );
  }
  getParticipants(conversationSid: string) {
    return this.http.get(`${environment.apiBaseUrl}/api/conversations/${conversationSid}`);
  }
}
```

---

## 5) Messages API service (send via backend)
Send messages through Django. Include the `from` attribute when appropriate (Django can auto-generate by role).

`messages.service.ts` (outline):
```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MessagesService {
  constructor(private http: HttpClient) {}
  send(conversationSid: string, message: string, from?: string) {
    return this.http.post(`${environment.apiBaseUrl}/api/twilio/message`, { conversationSid, message, from });
  }
}
```

---

## 6) Inquiries service
Mirror the prototype’s inquiry creation flow: create a Twilio conversation by REST JSON, add participants, send an initial system message, and persist a record.

`inquiries.service.ts` (outline):
```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InquiriesService {
  constructor(private http: HttpClient) {}
  create(payload: { customerName: string; customerEmail: string; customerPhone?: string; message: string; assignedExpertId: string; }) {
    return this.http.post(`${environment.apiBaseUrl}/api/inquiries`, payload);
  }
  list(params?: { page?: number; limit?: number }) {
    const page = params?.page ?? 1; const limit = params?.limit ?? 10;
    return this.http.get(`${environment.apiBaseUrl}/api/inquiries?page=${page}&limit=${limit}`);
  }
}
```

---

## 7) State management (simple RxJS)
A pragmatic approach is enough:
- Component-level state + `BehaviorSubject` for selected conversation and messages
- Use SDK events to update current conversation view in real time
- For lists, rely on the backend (index persisted by webhooks)

Example pattern:
```ts
const messages$ = new BehaviorSubject<any[]>([]);
// On load: fetch page via backend; on SDK message event: push into current list
```

---

## 8) Components (minimal set)
- `ConversationsListComponent` – uses `ConversationsService.list()` with pagination controls and search
- `ConversationViewComponent` – shows participants and a virtual-scrolled messages list
- `MessageComposerComponent` – calls `MessagesService.send()` and clears input
- `InquiriesViewComponent` – lists inquiries; links to corresponding conversation

Routing with `AuthGuard` and role-based guards (admin/expert) as needed.

---

## 9) Message display and the `from` attribute
Follow the prototype’s `from` attribute strategy to render identity and styles.

Helper (pipe or util):
```ts
export function getDisplayFrom(attributes?: any, fallbackAuthor?: string): { label: string; type: 'bot'|'admin'|'expert'|'traveler'|'user' } {
  const f = attributes?.from as string | undefined;
  if (f) {
    if (f === 'Bot') return { label: 'Bot', type: 'bot' };
    if (f === 'Baboo Team') return { label: 'Baboo Team', type: 'admin' };
    if (f.includes('- Local Expert')) return { label: f, type: 'expert' };
    if (f.includes('- Traveler')) return { label: f, type: 'traveler' };
    return { label: f, type: 'user' };
  }
  return { label: fallbackAuthor || 'Unknown', type: 'user' };
}
```

Style mapping:
- bot: green
- admin (Baboo Team): blue
- expert: purple
- traveler: orange
- current user: highlight

---

## 10) Virtualized message list (performance)
Use Angular CDK Virtual Scroll to render long threads efficiently.

```html
<cdk-virtual-scroll-viewport itemSize="64" class="messages">
  <div *cdkVirtualFor="let msg of messages | async" class="message-row">
    <!-- message bubble -->
  </div>
</cdk-virtual-scroll-viewport>
```

---

## 11) Error handling and UX
- Show connection status from `TwilioClientService.connection$()` (connecting/connected/denied)
- Gracefully handle API errors (toast + retry)
- Always log token refresh errors; re-init client if needed

---

## 12) Testing checklist
- Sign in and navigate behind `AuthGuard`
- Initialize SDK (state reaches `connected`)
- List conversations via backend and open one
- Send message; verify webhook updates list and the `from` label shows correctly
- Force token expiration and verify refresh path

---

## 13) Troubleshooting
- Empty conversation list: verify backend index and CORS; ensure Angular calls the Django endpoints
- No live updates: check SDK init/token; ensure `connectionStateChanged` is firing
- Wrong sender label: confirm `Attributes.from` is set in Django when sending
- SMS/WhatsApp relay: Make sure Django triggers Make.com on admin/expert messages (if applicable)

---

## 14) Useful references
- Twilio Conversations (overview): [link](https://www.twilio.com/docs/conversations)
- JS SDK overview: [link](https://www.twilio.com/docs/conversations/javascript/overview)
- Event handling: [link](https://www.twilio.com/docs/conversations/javascript/event-handling)
- Service resource: [link](https://www.twilio.com/docs/conversations/api/service-resource)
- Service configuration: [link](https://www.twilio.com/docs/conversations/api/service-configuration-resource)
- Delivery receipts: [link](https://www.twilio.com/docs/conversations/delivery-receipts)

This Angular plan keeps the UI responsive and simple while delegating heavy lifting (listing, security, routing) to Django and Twilio Conversations, exactly like the prototype but production-hardened.
