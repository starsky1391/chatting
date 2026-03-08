import amqp from 'amqplib';
import config from '../config';

class RabbitMQClient {
  private connection: any = null;
  private channel: any = null;
  private isConnected = false;

  /**
   * 连接到RabbitMQ
   * @returns Promise<void>
   */
  async connect(): Promise<void> {
    try {
      // 连接到RabbitMQ服务器
      this.connection = await amqp.connect(config.rabbitmq.url);
      console.log('✓ RabbitMQ connected successfully');

      // 创建通道
      if (this.connection) {
        this.channel = await this.connection.createChannel();
        console.log('✓ RabbitMQ channel created successfully');

        // 声明队列
        if (this.channel) {
          await this.channel.assertQueue('messages', {
            durable: true // 持久化队列，确保消息不会丢失
          });
        }
      }

      this.isConnected = true;
    } catch (error) {
      console.error('✗ RabbitMQ connection error:', error);
      this.isConnected = false;
    }
  }

  /**
   * 断开RabbitMQ连接
   * @returns Promise<void>
   */
  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('✓ RabbitMQ disconnected successfully');
      this.isConnected = false;
    } catch (error) {
      console.error('✗ Error disconnecting from RabbitMQ:', error);
    }
  }

  /**
   * 发送消息到队列
   * @param message 消息内容
   * @returns Promise<boolean>
   */
  async sendMessage(message: any): Promise<boolean> {
    try {
      if (!this.isConnected || !this.channel) {
        // 如果未连接，尝试重新连接
        await this.connect();
      }

      if (!this.channel) {
        console.error('✗ RabbitMQ channel not available');
        return false;
      }

      // 发送消息到队列
      const success = this.channel.sendToQueue('messages', Buffer.from(JSON.stringify(message)), {
        persistent: true // 持久化消息，确保消息不会丢失
      });

      return success;
    } catch (error) {
      console.error('✗ Error sending message to RabbitMQ:', error);
      return false;
    }
  }

  /**
   * 消费队列中的消息
   * @param callback 消息处理回调函数
   * @returns Promise<void>
   */
  async consumeMessages(callback: (message: any) => Promise<void>): Promise<void> {
    try {
      if (!this.isConnected || !this.channel) {
        // 如果未连接，尝试重新连接
        await this.connect();
      }

      if (!this.channel) {
        console.error('✗ RabbitMQ channel not available');
        return;
      }

      // 消费队列中的消息
      await this.channel.consume('messages', async (message: any) => {
        if (message) {
          try {
            // 解析消息内容
            const messageContent = JSON.parse(message.content.toString());
            // 调用回调函数处理消息
            await callback(messageContent);
            // 确认消息已处理
            this.channel?.ack(message);
          } catch (error) {
            console.error('✗ Error processing message:', error);
            // 拒绝消息，将其重新入队
            this.channel?.nack(message, false, true);
          }
        }
      }, {
        noAck: false // 手动确认消息
      });

      console.log('✓ RabbitMQ consumer started');
    } catch (error) {
      console.error('✗ Error starting RabbitMQ consumer:', error);
    }
  }
}

export const rabbitmqClient = new RabbitMQClient();
export default rabbitmqClient;
