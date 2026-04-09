// 数据库模型索引文件
// 用于初始化Sequelize实例和所有模型
// 这是数据库连接和模型同步的入口点

import { Sequelize, Dialect } from 'sequelize';
// 导入数据库配置
import databaseConfig from '../config/database';
// 导入模型类
import { User } from './User';
import { Channel } from './Channel';
import { Message } from './Message';
import { UserChannel } from './UserChannel';

// 清理 DATABASE_URL 中的 sslmode 参数，防止配置冲突
const cleanDatabaseUrl = (url: string): string => {
  return url.replace(/[?&]sslmode=[^&]*/gi, '');
};

// 获取数据库连接URL
const databaseUrl = process.env.DATABASE_URL 
  ? cleanDatabaseUrl(process.env.DATABASE_URL) 
  : '';

// 检测是否为 Railway 生产环境
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

// 创建Sequelize实例
// 优先使用环境变量中的DATABASE_URL
// 如果没有DATABASE_URL，则使用配置文件中的数据库连接参数
const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      logging: databaseConfig.logging,
      timezone: databaseConfig.timezone,
      pool: databaseConfig.pool,
      dialectOptions: {
        ssl: isRailway ? {
          require: true,
          rejectUnauthorized: false
        } : undefined
      }
    })
  : new Sequelize({
      dialect: databaseConfig.dialect as Dialect,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database,
      logging: databaseConfig.logging,
      timezone: databaseConfig.timezone,
      pool: databaseConfig.pool,
      dialectOptions: isRailway ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : undefined
    });

// 初始化所有模型
// 调用每个模型的initialize方法，传入Sequelize实例
// 这会将模型与数据库表关联起来
User.initialize(sequelize);
Channel.initialize(sequelize);
Message.initialize(sequelize);
UserChannel.initialize(sequelize);

// 定义模型关系
// 这里可以定义模型之间的关联关系，如一对多、多对多等

// 建立关联关系
// 用户与消息的关系：一个用户可以发送多条消息
User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages',
});

// 消息与发送者的关系：一条消息属于一个发送者
Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
});



// 频道与消息的关系：一个频道可以包含多条消息
Channel.hasMany(Message, {
  foreignKey: 'channelId',
  as: 'messages',
});

// 消息与频道的关系：一条消息属于一个频道
Message.belongsTo(Channel, {
  foreignKey: 'channelId',
  as: 'channel',
});

// 用户与频道的多对多关系：一个用户可以加入多个频道
User.belongsToMany(Channel, {
  through: UserChannel,
  foreignKey: 'userId',
  otherKey: 'channelId',
  as: 'channels',
});

// 频道与用户的多对多关系：一个频道可以有多个用户
Channel.belongsToMany(User, {
  through: UserChannel,
  foreignKey: 'channelId',
  otherKey: 'userId',
  as: 'members',
});

// 导出Sequelize实例和所有模型
export { sequelize, User, Channel, Message, UserChannel };
