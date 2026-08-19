import { MessageRepository as DbMessageRepository } from '../database/MessageRepository';

export interface DbMessage {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  timestamp: number;
}

export class MessageRepository extends DbMessageRepository {}
export default MessageRepository;
