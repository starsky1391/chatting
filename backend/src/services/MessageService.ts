import { Message } from '../models/Message';
import { messageRepository } from '../data/repositories/MessageRepository';
import { messageQueue } from '../reliability/message-queue';

export interface MessageWithSender {
  id: number;
  content: Record<string, any>;
  sender: {
    id: number;
    username: string;
    avatar: string;
  };
  channelId: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class MessageService {
  /**
   * Get messages by channel ID with sender information
   * @param channelId Channel ID
   * @param limit Limit of messages
   * @param before Timestamp to get messages before
   * @returns Promise<MessageWithSender[]>
   */
  async getMessagesByChannelId(channelId: number, limit: number = 50, before?: string): Promise<MessageWithSender[]> {
    // 转换时间戳字符串为Date对象
    const beforeDate = before ? new Date(parseInt(before, 10)) : undefined;

    // 使用MessageRepository获取消息
    const messages = await messageRepository.getMessagesByChannelId(channelId, {
      limit,
      before: beforeDate
    });
    
    // Map to the required format
    return messages.map(message => {
      // Ensure sender is loaded correctly from the include
      const senderData = (message as any).sender || {
        id: 0,
        username: 'Unknown',
        avatar: 'https://via.placeholder.com/40'
      };
      
      return {
        id: message.id,
        content: message.content,
        sender: {
          id: senderData.id,
          username: senderData.username,
          avatar: senderData.avatar
        },
        channelId: message.channelId,
        metadata: message.metadata,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      };
    });
  }

  /**
   * Create a new message
   * @param messageData Message data
   * @returns Promise<MessageWithSender>
   */
  async createMessage(messageData: {
    content: string;
    senderId: number;
    channelId: number;
    metadata?: Record<string, any>;
    sender?: {
      id: number;
      username: string;
      avatar: string;
    };
  }): Promise<MessageWithSender> {
    // 发送消息到RabbitMQ队列，异步处理写入数据库
    await messageQueue.sendMessage({
      content: messageData.content,
      senderId: messageData.senderId,
      channelId: messageData.channelId,
      metadata: messageData.metadata
    });

    // 返回一个临时的消息对象，包含发送者信息
    // 这样可以立即返回消息给客户端，而不需要等待数据库写入完成
    return {
      id: Date.now(), // 使用时间戳作为临时ID
      content: { type: 'text', body: messageData.content },
      sender: messageData.sender || {
        id: messageData.senderId,
        username: 'Unknown',
        avatar: 'https://via.placeholder.com/40'
      },
      channelId: messageData.channelId,
      metadata: messageData.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get message by ID with sender information
   * @param id Message ID
   * @returns Promise<MessageWithSender | null>
   */
  async getMessageById(id: number): Promise<MessageWithSender | null> {
    // 使用MessageRepository获取消息
    const message = await messageRepository.getMessageById(id);

    if (!message) return null;

    // Ensure sender is loaded correctly from the include
    const senderData = (message as any).sender || {
      id: 0,
      username: 'Unknown',
      avatar: 'https://via.placeholder.com/40'
    };

    return {
      id: message.id,
      content: message.content,
      sender: {
        id: senderData.id,
        username: senderData.username,
        avatar: senderData.avatar
      },
      channelId: message.channelId,
      metadata: message.metadata,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };
  }


}