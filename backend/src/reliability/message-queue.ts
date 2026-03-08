import { rabbitmqClient } from './rabbitmq-client';
import { messageRepository } from '../data/repositories/MessageRepository';

interface MessageQueueData {
  content: string;
  senderId: number;
  channelId: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

class MessageQueue {
  /**
   * 发送消息到队列
   * @param messageData 消息数据
   * @returns Promise<boolean>
   */
  async sendMessage(messageData: Omit<MessageQueueData, 'timestamp'>): Promise<boolean> {
    const queueData: MessageQueueData = {
      ...messageData,
      timestamp: Date.now()
    };

    return await rabbitmqClient.sendMessage(queueData);
  }

  /**
   * 启动消息消费者
   * @returns Promise<void>
   */
  async startConsumer(): Promise<void> {
    await rabbitmqClient.consumeMessages(async (messageData: MessageQueueData) => {
      try {
        // 从队列中消费消息，将其写入数据库
        await messageRepository.createMessage({
          content: messageData.content,
          senderId: messageData.senderId,
          channelId: messageData.channelId,
          metadata: messageData.metadata
        });

        console.log('✓ Message processed and saved to database');
      } catch (error) {
        console.error('✗ Error processing message from queue:', error);
        // 消息处理失败，会在 rabbitmq-client 中被重新入队
      }
    });
  }
}

export const messageQueue = new MessageQueue();
export default messageQueue;
