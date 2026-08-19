import { ThreadRepository as DbThreadRepository } from '../database/ThreadRepository';

export interface DbThread {
  id: string;
  title: string;
  created_at: number;
}

export class ThreadRepository extends DbThreadRepository {}
export default ThreadRepository;
