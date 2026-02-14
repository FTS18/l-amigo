export interface MessageHandler {
  handle(message: any, sender: chrome.runtime.MessageSender): Promise<any>;
}

export type MessageResponse = {
  success?: boolean;
  data?: any;
  error?: string;
  inProgress?: boolean;
  solvers?: any[];
  count?: number;
  goal?: number;
  profile?: any;
  username?: string;
  [key: string]: any;
};
