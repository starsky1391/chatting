import dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables
dotenv.config();

/**
 * Create the database if it doesn't exist
 */
async function createDatabase() {
  try {
    // Get database configuration from environment variables
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'chat_app'
    };

    console.log('Attempting to connect to PostgreSQL server...');
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Port: ${dbConfig.port}`);
    console.log(`Username: ${dbConfig.user}`);
    console.log(`Database to create: ${dbConfig.database}`);

    // First, connect to PostgreSQL without specifying a database
    const client = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'postgres' // Connect to the default postgres database
    });

    await client.connect();
    console.log('✓ Connected to PostgreSQL server');

    // Check if the database exists
    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = '${dbConfig.database}'`;
    const result = await client.query(checkDbQuery);

    if (result.rowCount === 0) {
      // Create the database
      const createDbQuery = `CREATE DATABASE ${dbConfig.database}`;
      await client.query(createDbQuery);
      console.log(`✓ Database '${dbConfig.database}' created successfully`);
    } else {
      console.log(`✓ Database '${dbConfig.database}' already exists`);
    }

    // Close the connection
    await client.end();
    console.log('\nDatabase setup completed!');
    console.log('You can now run the database initialization script:');
    console.log('npm run db:init');
  } catch (error) {
    console.error('✗ Error creating database:', error);
    process.exit(1);
  }
}

// Run the script
createDatabase();