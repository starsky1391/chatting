import dotenv from 'dotenv';
import { sequelize } from '../models';

// Load environment variables
dotenv.config();

/**
 * Initialize the database by syncing all models
 */
export const initDatabase = async (): Promise<void> => {
  try {
    console.log('Connecting to PostgreSQL database...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');
    
    // Sync all models to the database
    console.log('Syncing models to database...');
    await sequelize.sync();
    console.log('✓ All models synced successfully');
    
    console.log('\nDatabase initialization completed!');
    console.log('The following tables have been created/updated:');
    console.log('- users');
    console.log('- messages');
    console.log('- channels');
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    process.exit(1);
  }
};

// Run initialization if this script is executed directly
if (require.main === module) {
  initDatabase();
}