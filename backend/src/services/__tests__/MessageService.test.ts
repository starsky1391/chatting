import { MessageService } from '../MessageService';
import { messageQueue } from '../../reliability/message-queue';

// Mock the messageQueue
jest.mock('../../reliability/message-queue', () => {
  return {
    messageQueue: {
      sendMessage: jest.fn().mockResolvedValue(true)
    }
  };
});

describe('MessageService', () => {
  const messageService = new MessageService();
  const mockSendMessage = messageQueue.sendMessage as jest.MockedFunction<typeof messageQueue.sendMessage>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create message and send to queue', async () => {
    const messageData = {
      content: 'Test message',
      senderId: 1,
      channelId: 1,
      sender: {
        id: 1,
        username: 'testuser',
        avatar: 'https://via.placeholder.com/40'
      }
    };

    const result = await messageService.createMessage(messageData);

    // Verify that sendMessage was called with the correct data
    expect(mockSendMessage).toHaveBeenCalledWith({
      content: messageData.content,
      senderId: messageData.senderId,
      channelId: messageData.channelId
    });

    // Verify the returned message structure
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('content', messageData.content);
    expect(result).toHaveProperty('sender', messageData.sender);
    expect(result).toHaveProperty('channelId', messageData.channelId);
    expect(result).toHaveProperty('createdAt');
    expect(result).toHaveProperty('updatedAt');
  });

  test('should create message with metadata', async () => {
    const messageData = {
      content: 'Test message with metadata',
      senderId: 1,
      channelId: 1,
      metadata: { type: 'text', attachments: [] },
      sender: {
        id: 1,
        username: 'testuser',
        avatar: 'https://via.placeholder.com/40'
      }
    };

    const result = await messageService.createMessage(messageData);

    // Verify that sendMessage was called with the correct data
    expect(mockSendMessage).toHaveBeenCalledWith({
      content: messageData.content,
      senderId: messageData.senderId,
      channelId: messageData.channelId,
      metadata: messageData.metadata
    });

    // Verify the returned message structure
    expect(result).toHaveProperty('metadata', messageData.metadata);
  });

  test('should create message without sender information', async () => {
    const messageData = {
      content: 'Test message without sender',
      senderId: 1,
      channelId: 1
    };

    const result = await messageService.createMessage(messageData);

    // Verify that sendMessage was called with the correct data
    expect(mockSendMessage).toHaveBeenCalledWith({
      content: messageData.content,
      senderId: messageData.senderId,
      channelId: messageData.channelId
    });

    // Verify the returned message structure
    expect(result).toHaveProperty('sender');
    expect(result.sender.id).toBe(messageData.senderId);
    expect(result.sender.username).toBe('Unknown');
  });
});
