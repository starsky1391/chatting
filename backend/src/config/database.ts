// 数据库配置文件
// 用于配置Sequelize数据库连接
// 根据环境变量返回不同的数据库配置

// 从.env文件加载环境变量
import dotenv from 'dotenv';
dotenv.config();

// 数据库配置对象
const databaseConfig = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chat_app',
  // 是否输出SQL语句到控制台
  logging: console.log,
  // 是否自动同步模型到数据库
  synchronize: true,
  // 时区设置
  timezone: '+08:00',
  // 连接池配置
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

// 导出数据库配置
export default databaseConfig;
