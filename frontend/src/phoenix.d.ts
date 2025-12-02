declare module 'phoenix' {
  export class Socket {
    constructor(url: string, opts?: object);
    connect(): void;
    disconnect(callback?: () => void, code?: number, reason?: string): void;
    channel(topic: string, params?: object): Channel;
    onOpen(callback: () => void): void;
    onClose(callback: () => void): void;
    onError(callback: (error: any) => void): void;
    isConnected(): boolean;
  }

  export class Channel {
    constructor(topic: string, params?: object, socket?: Socket);
    join(): Push;
    leave(timeout?: number): Push;
    on(event: string, callback: (payload: any) => void): void;
    off(event: string, callback?: (payload: any) => void): void;
    push(event: string, payload: object, timeout?: number): Push;
  }

  export class Push {
    receive(status: string, callback: (response: any) => any): Push;
  }
}
